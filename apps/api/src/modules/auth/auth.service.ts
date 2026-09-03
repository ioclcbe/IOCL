import { createHmac, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { AuditAction, Prisma, UserRole } from "@prisma/client";
import type { LoginInput } from "@iocl/shared";
import { env } from "../../config/env.js";
import { ApiError } from "../../lib/api-error.js";
import { prisma } from "../../lib/prisma.js";

const ALLOWED_LOGIN_ROLES: UserRole[] = [
  UserRole.ENTRY_GATE_SECURITY,
  UserRole.EXIT_GATE_SECURITY,
  UserRole.SUPERVISOR,
  UserRole.ADMIN,
];

// Valid bcrypt hash used only to keep unknown-user and wrong-password paths closer in timing.
const DUMMY_BCRYPT_HASH = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

type RequestMeta = { ip?: string; userAgent?: string; requestId: string };
type AuthUser = {
  id: string;
  employeeCode: string;
  name: string;
  role: UserRole;
  authVersion: number;
};

function hashRefreshToken(token: string) {
  return createHmac("sha256", env.JWT_REFRESH_SECRET).update(token).digest("hex");
}

function ttlToMilliseconds(value: string) {
  const match = value.trim().match(/^(\d+)([smhd])$/i);
  if (!match) throw new Error("Invalid TTL");
  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase();
  const factor = unit === "d" ? 86_400_000 : unit === "h" ? 3_600_000 : unit === "m" ? 60_000 : 1_000;
  return amount * factor;
}

function sessionMaxExpiry(now = new Date()) {
  return new Date(now.getTime() + ttlToMilliseconds(env.SESSION_MAX_TTL));
}

function refreshExpiry(sessionExpiresAt: Date, now = new Date()) {
  return new Date(Math.min(
    now.getTime() + ttlToMilliseconds(env.JWT_REFRESH_TTL),
    sessionExpiresAt.getTime(),
  ));
}

function publicUser(user: AuthUser) {
  return {
    id: user.id,
    employeeCode: user.employeeCode,
    name: user.name,
    role: user.role,
  };
}

function accessTokenFor(user: AuthUser, sessionId: string, sessionExpiresAt: Date) {
  const remainingSessionMs = sessionExpiresAt.getTime() - Date.now();
  if (remainingSessionMs <= 0) throw new ApiError(401, "SESSION_MAX_EXPIRED", "Your shift session has expired. Please sign in again.");
  const expiresInSeconds = Math.max(1, Math.floor(Math.min(
    ttlToMilliseconds(env.JWT_ACCESS_TTL),
    remainingSessionMs,
  ) / 1_000));
  return jwt.sign(
    {
      employeeCode: user.employeeCode,
      role: user.role,
      type: "access",
      authVersion: user.authVersion,
      sessionId,
    },
    env.JWT_ACCESS_SECRET,
    {
      algorithm: "HS256",
      issuer: "iocl-gate-api",
      audience: "iocl-gate-web",
      subject: user.id,
      jwtid: randomUUID(),
      expiresIn: expiresInSeconds as SignOptions["expiresIn"],
    },
  );
}

function newRefreshToken() {
  return randomBytes(48).toString("base64url");
}

async function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      });
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!retryable || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 50));
    }
  }
  throw new Error("Unreachable transaction retry state");
}

async function recordSecurityEvent(
  eventType: string,
  employeeCode: string | undefined,
  actorId: string | undefined,
  meta: RequestMeta,
  metadata?: Prisma.InputJsonObject,
) {
  await prisma.securityEvent.create({
    data: {
      eventType,
      employeeCode,
      actorId,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
      metadata,
    },
  });
}

export async function login(input: LoginInput, meta: RequestMeta) {
  const employeeCode = input.employeeCode.trim().toUpperCase();
  const now = new Date();
  const user = await prisma.user.findUnique({ where: { employeeCode } });
  const passwordMatches = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_BCRYPT_HASH);

  if (user?.lockedUntil && user.lockedUntil > now) {
    await recordSecurityEvent("LOGIN_BLOCKED_LOCKED", employeeCode, user.id, meta, {
      lockedUntil: user.lockedUntil.toISOString(),
    });
    throw new ApiError(423, "ACCOUNT_LOCKED", "This account is temporarily locked. Contact the supervisor or try again later.");
  }

  if (!user || !user.isActive || !passwordMatches) {
    if (user) {
      await serializable(async (tx) => {
        const incremented = await tx.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: { increment: 1 } },
          select: { failedLoginAttempts: true },
        });
        const attempts = incremented.failedLoginAttempts;
        const lockedUntil = attempts >= env.LOGIN_MAX_ATTEMPTS
          ? new Date(now.getTime() + env.LOGIN_LOCK_MINUTES * 60_000)
          : null;
        if (lockedUntil) {
          await tx.user.update({ where: { id: user.id }, data: { lockedUntil } });
        }
        await tx.securityEvent.create({
          data: {
            eventType: lockedUntil ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
            employeeCode,
            actorId: user.id,
            ipAddress: meta.ip,
            userAgent: meta.userAgent,
            requestId: meta.requestId,
            metadata: { attempts },
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            actorRole: user.role,
            entityType: "AUTH",
            entityId: user.id,
            action: AuditAction.LOGIN_FAILED,
            changedFields: ["failedLoginAttempts", "lockedUntil"],
            afterData: { employeeCode, attempts, lockedUntil: lockedUntil?.toISOString() ?? null },
            ipAddress: meta.ip,
            userAgent: meta.userAgent,
            requestId: meta.requestId,
          },
        });
      });
    } else {
      await recordSecurityEvent("LOGIN_FAILED_UNKNOWN_USER", employeeCode, undefined, meta);
    }
    throw new ApiError(401, "INVALID_CREDENTIALS", "Employee code or password is incorrect");
  }

  if (!ALLOWED_LOGIN_ROLES.includes(user.role)) {
    await recordSecurityEvent("LOGIN_WRONG_GATE_ROLE", employeeCode, user.id, meta, { role: user.role });
    throw new ApiError(403, "WRONG_GATE_ROLE", "This account is not authorized for the Lorry Gate Management System");
  }

  const sessionId = randomUUID();
  const refreshToken = newRefreshToken();
  const sessionExpiresAt = sessionMaxExpiry(now);
  const expiresAt = refreshExpiry(sessionExpiresAt, now);

  const updatedUser = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.deleteMany({ where: { userId: user.id, expiresAt: { lt: now } } });
    const updated = await tx.user.update({
      where: { id: user.id },
      data: { lastLoginAt: now, failedLoginAttempts: 0, lockedUntil: null },
    });
    await tx.refreshToken.create({
      data: {
        userId: user.id,
        sessionId,
        authVersion: updated.authVersion,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt,
        sessionExpiresAt,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorRole: user.role,
        entityType: "AUTH",
        entityId: sessionId,
        action: AuditAction.LOGIN,
        afterData: { employeeCode: user.employeeCode, role: user.role, sessionId },
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      },
    });
    return updated;
  }, { maxWait: 20000, timeout: 30000 });

  return {
    accessToken: accessTokenFor(updatedUser, sessionId, sessionExpiresAt),
    refreshToken,
    refreshExpiresAt: expiresAt,
    sessionExpiresAt,
    user: publicUser(updatedUser),
  };
}

export async function refreshSession(rawToken: string | undefined, meta: RequestMeta) {
  if (!rawToken) throw new ApiError(401, "REFRESH_REQUIRED", "Please sign in again");
  const incomingHash = hashRefreshToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: incomingHash },
    include: { user: true },
  });

  if (!existing) {
    await recordSecurityEvent("REFRESH_TOKEN_UNKNOWN", undefined, undefined, meta);
    throw new ApiError(401, "INVALID_REFRESH", "Your session has expired. Please sign in again.");
  }

  const now = new Date();
  if (existing.revokedAt) {
    const isRecentSameClientRotation =
      existing.revokeReason === "ROTATED" &&
      now.getTime() - existing.revokedAt.getTime() < 10_000 &&
      existing.ipAddress === meta.ip &&
      existing.userAgent === meta.userAgent;

    if (!isRecentSameClientRotation) {
      await prisma.$transaction([
        prisma.refreshToken.updateMany({
          where: { userId: existing.userId, revokedAt: null },
          data: { revokedAt: now, revokeReason: "REUSE_DETECTED" },
        }),
        prisma.user.update({
          where: { id: existing.userId },
          data: { authVersion: { increment: 1 } },
        }),
        prisma.securityEvent.create({
          data: {
            eventType: "REFRESH_TOKEN_REUSE_DETECTED",
            employeeCode: existing.user.employeeCode,
            actorId: existing.userId,
            ipAddress: meta.ip,
            userAgent: meta.userAgent,
            requestId: meta.requestId,
            metadata: { sessionId: existing.sessionId },
          },
        }),
      ]);
    }
    throw new ApiError(401, "INVALID_REFRESH", "Your session has expired. Please sign in again.");
  }

  const authVersionChanged = existing.authVersion !== existing.user.authVersion;
  const sessionMaxExpired = existing.sessionExpiresAt <= now;
  if (existing.expiresAt <= now || sessionMaxExpired || !existing.user.isActive || authVersionChanged) {
    await prisma.refreshToken.update({
      where: { id: existing.id },
      data: {
        revokedAt: now,
        revokeReason: sessionMaxExpired
          ? "SESSION_MAX_EXPIRED"
          : existing.expiresAt <= now
            ? "EXPIRED"
            : !existing.user.isActive
            ? "USER_DISABLED"
            : "AUTH_VERSION_CHANGED",
      },
    });
    throw new ApiError(401, "INVALID_REFRESH", "Your session has expired. Please sign in again.");
  }
  if (!ALLOWED_LOGIN_ROLES.includes(existing.user.role)) {
    throw new ApiError(403, "WRONG_GATE_ROLE", "This account is not authorized for the Lorry Gate Management System");
  }

  const replacementToken = newRefreshToken();
  const replacementExpiry = refreshExpiry(existing.sessionExpiresAt, now);

  const result = await prisma.$transaction(
    async (tx) => {
      const rotated = await tx.refreshToken.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: { revokedAt: now, revokeReason: "ROTATED", lastUsedAt: now },
      });
      if (rotated.count !== 1) {
        throw new ApiError(401, "INVALID_REFRESH", "Your session has expired. Please sign in again.");
      }
      await tx.refreshToken.create({
        data: {
          userId: existing.userId,
          sessionId: existing.sessionId,
          authVersion: existing.user.authVersion,
          tokenHash: hashRefreshToken(replacementToken),
          expiresAt: replacementExpiry,
          sessionExpiresAt: existing.sessionExpiresAt,
          ipAddress: meta.ip,
          userAgent: meta.userAgent,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: existing.userId,
          actorRole: existing.user.role,
          entityType: "AUTH",
          entityId: existing.sessionId,
          action: AuditAction.TOKEN_REFRESH,
          ipAddress: meta.ip,
          userAgent: meta.userAgent,
          requestId: meta.requestId,
        },
      });
      return existing.user;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  return {
    accessToken: accessTokenFor(result, existing.sessionId, existing.sessionExpiresAt),
    refreshToken: replacementToken,
    refreshExpiresAt: replacementExpiry,
    sessionExpiresAt: existing.sessionExpiresAt,
    user: publicUser(result),
  };
}

export async function logout(rawToken: string | undefined, meta: RequestMeta) {
  if (!rawToken) return;
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(rawToken) },
    include: { user: { select: { role: true } } },
  });
  if (!stored) return;
  const now = new Date();
  await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: { sessionId: stored.sessionId, revokedAt: null },
      data: { revokedAt: now, revokeReason: "LOGOUT" },
    }),
    prisma.auditLog.create({
      data: {
        actorId: stored.userId,
        actorRole: stored.user.role,
        entityType: "AUTH",
        entityId: stored.sessionId,
        action: AuditAction.LOGOUT,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      },
    }),
  ]);
}
