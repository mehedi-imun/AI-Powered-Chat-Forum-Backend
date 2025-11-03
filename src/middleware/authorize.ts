import { NextFunction, Response } from "express";
import AppError from "../errors/AppError";
import { AuthRequest } from "./authenticate";

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    if (!roles.includes(req.user.role)) {
      throw new AppError(
        403,
        `Forbidden - Requires one of: ${roles.join(", ")}`
      );
    }

    next();
  };
};
