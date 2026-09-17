import bcrypt from "bcryptjs";
import { AuditAction, Prisma, UserRole } from "@prisma/client";
import { Router, type Request } from "express";
import { z } from "zod";
import { createUserSchema, resetPasswordSchema, updateUserSchema, userListFilterSchema } from "@iocl/shared";
import { ApiError } from "../../lib/api-error.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate, authorize } from "../../middleware/auth.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";

const idParams = z.object({ id: z.string().uuid() }).strict();
const publicSelect = {
  id: true,
  employeeCode: true,
  name: true,
  role: true,
  isActive: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

function requestMeta(req: Request) {
  return { ipAddress: req.ip, userAgent: req.header("user-agent")?.slice(0, 500), requestId: req.requestId };
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

export const userRouter = Router();
userRouter.use(authenticate, authorize(UserRole.ADMIN));

userRouter.get(
  "/",
  validateQuery(userListFilterSchema),
  asyncHandler(async (_req, res) => {
    const query = res.locals.validatedQuery;
    const where: Prisma.UserWhereInput = {};
    if (query.search) {
      where.OR = [
        { employeeCode: { contains: query.search, mode: "insensitive" } },
        { name: { contains: query.search, mode: "insensitive" } },
      ];
    }
    if (query.role) where.role = query.role;
    if (query.active === "active") where.isActive = true;
    if (query.active === "disabled") where.isActive = false;
    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({ where, select: publicSelect, orderBy: [{ isActive: "desc" }, { name: "asc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      prisma.user.count({ where }),
    ]);
    res.json({ success: true, data: { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) } });
  }),
);

userRouter.post(
  "/",
  validateBody(createUserSchema),
  asyncHandler(async (req, res) => {
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { employeeCode: req.body.employeeCode, name: req.body.name, role: req.body.role, passwordHash },
        select: publicSelect,
      });
      await tx.auditLog.create({
        data: {
          actorId: req.auth!.userId,
          actorRole: req.auth!.role,
          entityType: "USER",
          entityId: created.id,
          action: AuditAction.USER_CREATE,
          changedFields: ["employeeCode", "name", "role", "isActive"],
          afterData: { employeeCode: created.employeeCode, name: created.name, role: created.role, isActive: created.isActive },
          ...requestMeta(req),
        },
      });
      return created;
    });
    res.status(201).json({ success: true, data: user, message: "User created" });
  }),
);

userRouter.patch(
  "/:id",
  validateParams(idParams),
  validateBody(updateUserSchema),
  asyncHandler(async (req, res) => {
    const id = res.locals.validatedParams.id;
    const user = await serializable(async (tx) => {
      const before = await tx.user.findUnique({ where: { id }, select: publicSelect });
      if (!before) throw new ApiError(404, "USER_NOT_FOUND", "User was not found");

      const removesAdminAccess = req.body.isActive === false ||
        (req.body.role !== undefined && req.body.role !== UserRole.ADMIN);
      if (id === req.auth!.userId && removesAdminAccess) {
        throw new ApiError(422, "SELF_ADMIN_LOCKOUT", "You cannot disable or remove your own administrator role");
      }
      if (before.role === UserRole.ADMIN && before.isActive && removesAdminAccess) {
        const activeAdmins = await tx.user.count({ where: { role: UserRole.ADMIN, isActive: true } });
        if (activeAdmins <= 1) {
          throw new ApiError(422, "LAST_ADMIN_REQUIRED", "At least one active administrator must remain");
        }
      }

      const authSensitive = req.body.role !== undefined || req.body.employeeCode !== undefined || req.body.isActive !== undefined;
      const updated = await tx.user.update({
        where: { id },
        data: {
          ...(req.body.employeeCode !== undefined ? { employeeCode: req.body.employeeCode } : {}),
          ...(req.body.name !== undefined ? { name: req.body.name } : {}),
          ...(req.body.role !== undefined ? { role: req.body.role } : {}),
          ...(req.body.isActive !== undefined ? { isActive: req.body.isActive } : {}),
          ...(req.body.unlock ? { failedLoginAttempts: 0, lockedUntil: null } : {}),
          ...(authSensitive ? { authVersion: { increment: 1 } } : {}),
        },
        select: publicSelect,
      });
      if (authSensitive) {
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date(), revokeReason: "ADMIN_USER_UPDATE" },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: req.auth!.userId,
          actorRole: req.auth!.role,
          entityType: "USER",
          entityId: id,
          action: AuditAction.USER_UPDATE,
          changedFields: Object.keys(req.body),
          beforeData: { employeeCode: before.employeeCode, name: before.name, role: before.role, isActive: before.isActive, lockedUntil: before.lockedUntil },
          afterData: { employeeCode: updated.employeeCode, name: updated.name, role: updated.role, isActive: updated.isActive, lockedUntil: updated.lockedUntil },
          ...requestMeta(req),
        },
      });
      return updated;
    });
    res.json({ success: true, data: user, message: "User updated and active sessions refreshed" });
  }),
);

userRouter.post(
  "/:id/reset-password",
  validateParams(idParams),
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const id = res.locals.validatedParams.id;
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { passwordHash, lastPasswordChangedAt: new Date(), authVersion: { increment: 1 }, failedLoginAttempts: 0, lockedUntil: null },
        select: publicSelect,
      });
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: "PASSWORD_RESET" } });
      await tx.auditLog.create({
        data: {
          actorId: req.auth!.userId,
          actorRole: req.auth!.role,
          entityType: "USER",
          entityId: id,
          action: AuditAction.PASSWORD_RESET,
          changedFields: ["passwordHash", "lastPasswordChangedAt", "authVersion", "failedLoginAttempts", "lockedUntil"],
          afterData: { employeeCode: updated.employeeCode, passwordResetAt: new Date().toISOString() },
          ...requestMeta(req),
        },
      });
      return updated;
    }).catch((error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new ApiError(404, "USER_NOT_FOUND", "User was not found");
      }
      throw error;
    });
    res.json({ success: true, data: user, message: "Password reset and all sessions revoked" });
  }),
);

userRouter.delete(
  "/:id",
  validateParams(idParams),
  asyncHandler(async (req, res) => {
    const id = res.locals.validatedParams.id;
    if (id === req.auth!.userId) {
      throw new ApiError(422, "SELF_DELETE", "You cannot delete yourself");
    }
    const user = await serializable(async (tx) => {
      const before = await tx.user.findUnique({ where: { id } });
      if (!before) throw new ApiError(404, "USER_NOT_FOUND", "User was not found");

      await tx.auditLog.deleteMany({ where: { actorId: id } });
      await tx.securityEvent.deleteMany({ where: { actorId: id } });
      await tx.refreshToken.deleteMany({ where: { userId: id } });
      
      const deleted = await tx.user.delete({ where: { id } });
      
      await tx.auditLog.create({
        data: {
          actorId: req.auth!.userId,
          actorRole: req.auth!.role,
          entityType: "USER",
          entityId: id,
          action: AuditAction.DELETE,
          beforeData: before as any,
          ...requestMeta(req),
        },
      });
      return deleted;
    });
    res.json({ success: true, message: "User deleted successfully" });
  })
);
