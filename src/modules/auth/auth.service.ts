import logger from "../../utils/logger";
import httpStatus from "http-status";
import env from "../../config/env";
import { cacheService } from "../../config/redis";
import AppError from "../../errors/AppError";
import { emailService } from "../../services/email.service";
import {
  generateAccessToken,
  generatePasswordResetToken,
  generateRefreshToken,
  hashResetToken,
  verifyRefreshToken,
} from "../../utils/jwt";
import { User } from "../user/user.model";
import type { IUser } from "../user/user.interface";
import type { ILoginResponse, IRefreshTokenResponse } from "./auth.interface";

const login = async (
  email: string,
  password: string
): Promise<ILoginResponse> => {
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password");
  }

  if (!user.emailVerified) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Please verify your email address before logging in"
    );
  }

  const isPasswordValid = await (user as any).comparePassword(password);
  if (!isPasswordValid) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password");
  }

  const tokenPayload = {
    userId: user._id?.toString(),
    email: user.email,
    role: user.role,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  user.lastLoginAt = new Date();
  await user.save();

  const userResponse: any = user.toJSON();

  return {
    user: {
      _id: userResponse._id,
      email: userResponse.email,
      name: userResponse.name,
      role: userResponse.role,
      avatar: userResponse.avatar,
      bio: userResponse.bio,
    },
    accessToken,
    refreshToken,
  };
};

const refreshAccessToken = async (
  refreshToken: string
): Promise<IRefreshTokenResponse> => {
  try {
    const decoded = verifyRefreshToken(refreshToken);

    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new AppError(httpStatus.UNAUTHORIZED, "Invalid refresh token");
    }

    const tokenPayload = {
      userId: user._id?.toString(),
      email: user.email,
      role: user.role,
    };

    const newAccessToken = generateAccessToken(tokenPayload);

    return {
      accessToken: newAccessToken,
    };
  } catch (_error) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid refresh token");
  }
};

const register = async (
  name: string,
  email: string,
  password: string
): Promise<{ message: string; user: { email: string } }> => {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError(
      httpStatus.CONFLICT,
      "User with this email already exists"
    );
  }

  const verificationToken = generatePasswordResetToken();
  const hashedToken = hashResetToken(verificationToken);

  const user = await User.create({
    name,
    email,
    password,
    role: "Member",
    emailVerified: false,
    emailVerificationToken: hashedToken,
    emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  });

  const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
  logger.info(`Sending verification email to ${user.email}`);
  logger.info(`Verification URL: ${verificationUrl}`);

  const emailPromise = emailService.sendEmailVerification(
    user.email,
    user.name,
    verificationUrl
  );
  if (emailPromise && typeof emailPromise.catch === "function") {
    emailPromise.catch((err) =>
      logger.error("Failed to send verification email")
    );
  }
  return {
    message:
      "Registration successful! Please check your email to verify your account.",
    user: {
      email: user.email,
    },
  };
};

const forgotPassword = async (email: string): Promise<{ message: string }> => {
  const user = await User.findOne({ email });
  if (!user) {
    return {
      message:
        "If a user with that email exists, a password reset link has been sent.",
    };
  }

  const resetToken = generatePasswordResetToken();
  user.passwordResetToken = hashResetToken(resetToken);
  user.passwordResetExpires = new Date(Date.now() + 3600000);
  await user.save();

  const emailPromise = emailService.sendPasswordResetEmail(
    user.email,
    resetToken,
    user.name
  );
  if (emailPromise && typeof emailPromise.catch === "function") {
    emailPromise.catch((err) =>
      logger.error("Failed to send password reset email")
    );
  }

  return {
    message:
      "If a user with that email exists, a password reset link has been sent.",
  };
};

const resetPassword = async (
  token: string,
  newPassword: string
): Promise<{ message: string }> => {
  const hashedToken = hashResetToken(token);

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid or expired reset token"
    );
  }

  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  return {
    message: "Password has been reset successfully",
  };
};

const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ message: string }> => {
  const user = await User.findById(userId).select("+password");
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const isPasswordValid = await (user as any).comparePassword(currentPassword);
  if (!isPasswordValid) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Current password is incorrect"
    );
  }

  user.password = newPassword;
  await user.save();

  return {
    message: "Password changed successfully",
  };
};

const verifyEmail = async (
  token: string
): Promise<{
  message: string;
  accessToken: string;
  refreshToken: string;
  user: Partial<IUser>;
}> => {
  const hashedToken = hashResetToken(token);

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid or expired verification token"
    );
  }

  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  const refreshToken = generateRefreshToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  await cacheService.set(
    `refreshToken:${user._id}`,
    refreshToken,
    7 * 24 * 60 * 60
  );

  return {
    message: "Email verified successfully. You are now logged in!",
    accessToken,
    refreshToken,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      emailVerified: user.emailVerified,
    },
  };
};

export const AuthService = {
  login,
  refreshAccessToken,
  register,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyEmail,
};
