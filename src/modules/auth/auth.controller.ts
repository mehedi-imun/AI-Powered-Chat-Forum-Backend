import type { Request, Response } from "express";
import httpStatus from "http-status";
import env from "../../config/env";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { AuthService } from "./auth.service";

const login = catchAsync(async (req: Request, res: Response) => {
	const { email, password } = req.body;
	const result = await AuthService.login(email, password);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Login successful",
		data: result,
	});
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
	const { refreshToken } = req.body;
	const result = await AuthService.refreshAccessToken(refreshToken);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Access token refreshed successfully",
		data: result,
	});
});

const register = catchAsync(async (req: Request, res: Response) => {
	const { name, email, password } = req.body;
	const result = await AuthService.register(name, email, password);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: result.message,
		data: {
			user: result.user,
		},
	});
});

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
	const { email } = req.body;
	const result = await AuthService.forgotPassword(email);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: null,
	});
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
	const { token, newPassword } = req.body;
	const result = await AuthService.resetPassword(token, newPassword);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: null,
	});
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const { currentPassword, newPassword } = req.body;
	const result = await AuthService.changePassword(
		userId,
		currentPassword,
		newPassword,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: null,
	});
});

const verifyEmail = catchAsync(async (req: Request, res: Response) => {
	const { token } = req.body;
	const result = await AuthService.verifyEmail(token);

	res.cookie("accessToken", result.accessToken, {
		httpOnly: true,
		secure: env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 15 * 60 * 1000, // 15 minutes
	});

	res.cookie("refreshToken", result.refreshToken, {
		httpOnly: true,
		secure: env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: {
			user: result.user,
			accessToken: result.accessToken,
			refreshToken: result.refreshToken,
		},
	});
});

export const AuthController = {
	login,
	refreshToken,
	register,
	forgotPassword,
	resetPassword,
	changePassword,
	verifyEmail,
};
