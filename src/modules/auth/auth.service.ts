import httpStatus from "http-status";
import env from "../../config/env";
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
import type { ILoginResponse, IRefreshTokenResponse } from "./auth.interface";

// Login user
const login = async (
	email: string,
	password: string,
): Promise<ILoginResponse> => {
	const user = await User.findOne({ email }).select("+password");

	if (!user) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password");
	}

	if (!user.emailVerified) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Please verify your email address before logging in",
		);
	}

	const isPasswordValid = await (user as any).comparePassword(password);
	if (!isPasswordValid) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password");
	}

	const tokenPayload = {
		userId: user._id!.toString(),
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

// Refresh access token
const refreshAccessToken = async (
	refreshToken: string,
): Promise<IRefreshTokenResponse> => {
	try {
		const decoded = verifyRefreshToken(refreshToken);

		const user = await User.findById(decoded.userId);
		if (!user) {
			throw new AppError(httpStatus.UNAUTHORIZED, "Invalid refresh token");
		}

		const tokenPayload = {
			userId: user._id!.toString(),
			email: user.email,
			role: user.role,
		};

		const newAccessToken = generateAccessToken(tokenPayload);

		return {
			accessToken: newAccessToken,
		};
	} catch (error) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid refresh token");
	}
};

// Register new user
const register = async (
	name: string,
	email: string,
	password: string,
): Promise<{ message: string }> => {
	const existingUser = await User.findOne({ email });
	if (existingUser) {
		throw new AppError(
			httpStatus.CONFLICT,
			"User with this email already exists",
		);
	}

	const user = await User.create({
		name,
		email,
		password,
		role: "Member",
		emailVerified: true, // Auto-verify for now (change to false when email verification is ready)
	});

	emailService
		.sendEmailVerification(
			user.email,
			user.name,
			`${env.FRONTEND_URL}/verify-email?token=dummy-token`,
		)
		.catch((err) => console.error("Failed to send welcome email:", err));

	return {
		message: "Registration successful! Welcome to Chat Forum.",
	};
};

// Request password reset
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

	emailService
		.sendPasswordResetEmail(user.email, resetToken, user.name)
		.catch((err) => console.error("Failed to send password reset email:", err));

	return {
		message:
			"If a user with that email exists, a password reset link has been sent.",
	};
};

// Reset password with token
const resetPassword = async (
	token: string,
	newPassword: string,
): Promise<{ message: string }> => {
	const hashedToken = hashResetToken(token);

	const user = await User.findOne({
		passwordResetToken: hashedToken,
		passwordResetExpires: { $gt: new Date() },
	});

	if (!user) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Invalid or expired reset token",
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

// Change password (for logged-in users)
const changePassword = async (
	userId: string,
	currentPassword: string,
	newPassword: string,
): Promise<{ message: string }> => {
	const user = await User.findById(userId).select("+password");
	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	const isPasswordValid = await (user as any).comparePassword(currentPassword);
	if (!isPasswordValid) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Current password is incorrect",
		);
	}

	user.password = newPassword;
	await user.save();

	return {
		message: "Password changed successfully",
	};
};

// Verify email with token
const verifyEmail = async (token: string): Promise<{ message: string }> => {
	const hashedToken = hashResetToken(token);

	const user = await User.findOne({
		emailVerificationToken: hashedToken,
		emailVerificationExpires: { $gt: new Date() },
	});

	if (!user) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Invalid or expired verification token",
		);
	}

	user.emailVerified = true;
	user.emailVerificationToken = undefined;
	user.emailVerificationExpires = undefined;
	await user.save();

	return {
		message: "Email verified successfully",
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
