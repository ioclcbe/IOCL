import { Router } from "express";
import rateLimitPkg from "express-rate-limit";
const rateLimit = (rateLimitPkg as any).default || rateLimitPkg;
import { loginSchema, changePasswordSchema } from "@iocl/shared";
import { asyncHandler } from "../../lib/async-handler.js";
import { authenticate } from "../../middleware/auth.js";
import { requireTrustedOrigin } from "../../middleware/origin-guard.js";
import { validateBody } from "../../middleware/validate.js";
import * as controller from "./auth.controller.js";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 2000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: { code: "TOO_MANY_ATTEMPTS", message: "Too many login attempts. Try again later." },
  },
});

const refreshLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

authRouter.post("/login", requireTrustedOrigin, loginLimiter, validateBody(loginSchema), asyncHandler(controller.login));
authRouter.post("/refresh", requireTrustedOrigin, refreshLimiter, asyncHandler(controller.refresh));
authRouter.post("/logout", requireTrustedOrigin, asyncHandler(controller.logout));
authRouter.get("/me", authenticate, (req, res) => {
  res.json({ success: true, data: req.auth });
});

authRouter.post("/change-password", authenticate, validateBody(changePasswordSchema), asyncHandler(controller.changePassword));
