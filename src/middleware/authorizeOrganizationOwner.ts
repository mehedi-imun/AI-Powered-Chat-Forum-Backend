import type { NextFunction, Response } from "express";
import AppError from "../errors/AppError";
import type { AuthRequest } from "./authenticate";

export const authorizeOrganizationOwner = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    throw new AppError(401, "Unauthorized");
  }

  if (req.user.role !== "Admin") {
    throw new AppError(403, "Forbidden - Requires Admin privileges");
  }

  next();
};
