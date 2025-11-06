import type { NextFunction, Request, Response } from "express";
import AppError from "../errors/AppError";
import { User } from "../modules/user/user.model";
import { verifyAccessToken } from "../utils/jwt";

export interface AuthUser {
  userId: string;
  email: string;
  role: "Admin" | "Moderator" | "Member";
  emailVerified?: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
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

    req.user = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
    };
    next();
  } catch (error) {
    next(error);
  }
};

export const authenticateOptional = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.userId);
      if (user?.isActive) {
        req.user = {
          userId: user._id.toString(),
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
        };
      }
    }
    next();
  } catch (_error) {
    next();
  }
};
