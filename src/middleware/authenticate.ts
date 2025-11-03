import { NextFunction, Request, Response } from "express";
import AppError from "../errors/AppError";
import { User } from "../modules/user/user.model";
import { verifyAccessToken } from "../utils/jwt";

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      throw new AppError(401, "Unauthorized - No token provided");
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      throw new AppError(401, "Unauthorized - Invalid user");
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const authenticateOptional = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.userId);
      if (user && user.isActive) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    next();
  }
};
