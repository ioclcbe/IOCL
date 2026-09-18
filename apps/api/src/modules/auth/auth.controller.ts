import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import * as authService from "./auth.service.js";

const cookieBase = {
  httpOnly: true,
  sameSite: env.COOKIE_SAME_SITE,
  secure: env.COOKIE_SECURE,
  path: "/api/v1/auth",
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
};

function requestMeta(req: Request) {
  return {
    ip: req.ip,
    userAgent: req.header("user-agent")?.slice(0, 500),
    requestId: req.requestId,
  };
}

function setRefreshCookie(res: Response, token: string, expires: Date) {
  res.cookie(env.COOKIE_NAME, token, { ...cookieBase, expires });
}

export async function login(req: Request, res: Response) {
  const result = await authService.login(req.body, requestMeta(req));
  setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
  res.setHeader("Cache-Control", "no-store");
  res.json({
    success: true,
    data: { accessToken: result.accessToken, user: result.user },
    message: "Login successful",
  });
}

export async function refresh(req: Request, res: Response) {
  const result = await authService.refreshSession(req.cookies?.[env.COOKIE_NAME], requestMeta(req));
  setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
  res.setHeader("Cache-Control", "no-store");
  res.json({ success: true, data: { accessToken: result.accessToken, user: result.user } });
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.cookies?.[env.COOKIE_NAME], requestMeta(req));
  res.clearCookie(env.COOKIE_NAME, cookieBase);
  res.setHeader("Cache-Control", "no-store");
  res.json({ success: true, data: null, message: "Logged out" });
}

export async function changePassword(req: Request, res: Response) {
  await authService.changePassword(req.auth!.userId, req.body, requestMeta(req));
  res.clearCookie(env.COOKIE_NAME, cookieBase);
  res.setHeader("Cache-Control", "no-store");
  res.json({ success: true, data: null, message: "Password changed successfully. Please log in again." });
}
