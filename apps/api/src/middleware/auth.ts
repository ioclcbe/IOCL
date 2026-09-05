import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { env } from "../config/env.js";
import { ApiError } from "../lib/api-error.js";
import { prisma } from "../lib/prisma.js";

interface AccessClaims extends jwt.JwtPayload {
  sub: string;
  employeeCode: string;
  role: UserRole;
  type: "access";
  authVersion: number;
  sessionId: string;
}

// In-memory cache: userId -> { user data, expiresAt }
// Prevents repeated DB lookups on every request (critical for Neon serverless cold-starts)
const userCache = new Map<string, { employeeCode: string; role: UserRole; isActive: boolean; authVersion: number; expiresAt: number }>();
const USER_CACHE_TTL_MS = 60_000; // 60 seconds

function getCachedUser(id: string) {
  const entry = userCache.get(id);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { userCache.delete(id); return null; }
  return entry;
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    return next(new ApiError(401, "AUTH_REQUIRED", "Authentication is required"));
  }

  void (async () => {
    try {
      const token = header.slice(7).trim();
      const claims = jwt.verify(token, env.JWT_ACCESS_SECRET, {
        algorithms: ["HS256"],
        issuer: "iocl-gate-api",
        audience: "iocl-gate-web",
      }) as AccessClaims;

      if (
        claims.type !== "access" ||
        !claims.sub ||
        !claims.employeeCode ||
        !claims.role ||
        !claims.sessionId ||
        !Number.isInteger(claims.authVersion)
      ) {
        throw new Error("Invalid access-token claims");
      }

      // Try cache first, only hit DB on cache miss
      let user = getCachedUser(claims.sub);
      if (!user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: claims.sub },
          select: { employeeCode: true, role: true, isActive: true, authVersion: true },
        });
        if (dbUser) {
          userCache.set(claims.sub, { ...dbUser, expiresAt: Date.now() + USER_CACHE_TTL_MS });
          user = getCachedUser(claims.sub);
        }
      }

      if (
        !user ||
        !user.isActive ||
        user.authVersion !== claims.authVersion ||
        user.employeeCode !== claims.employeeCode ||
        user.role !== claims.role
      ) {
        userCache.delete(claims.sub);
        throw new Error("Access token is no longer valid");
      }

      req.auth = {
        userId: claims.sub,
        employeeCode: claims.employeeCode,
        role: claims.role,
        authVersion: claims.authVersion,
        sessionId: claims.sessionId,
      };
      next();
    } catch {
      next(new ApiError(401, "INVALID_TOKEN", "Your session is invalid or has expired"));
    }
  })();
}

export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(new ApiError(401, "AUTH_REQUIRED", "Authentication is required"));
    if (!roles.includes(req.auth.role)) {
      return next(new ApiError(403, "FORBIDDEN", "You do not have permission for this gate operation"));
    }
    next();
  };
}
