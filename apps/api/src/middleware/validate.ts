import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { ApiError } from "../lib/api-error.js";

export function validateBody(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      console.error("VALIDATION ERROR. Body:", req.body, "Errors:", result.error.flatten().fieldErrors);
      return next(
        new ApiError(422, "VALIDATION_ERROR", "Please correct the highlighted fields", {
          fieldErrors: result.error.flatten().fieldErrors,
        }),
      );
    }
    req.body = result.data;
    res.locals.validatedBody = result.data;
    next();
  };
}

export function validateQuery(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(new ApiError(422, "VALIDATION_ERROR", "Invalid filters", result.error.flatten()));
    }
    res.locals.validatedQuery = result.data;
    next();
  };
}

export function validateParams(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return next(new ApiError(422, "VALIDATION_ERROR", "Invalid route parameter", result.error.flatten()));
    }
    res.locals.validatedParams = result.data;
    next();
  };
}
