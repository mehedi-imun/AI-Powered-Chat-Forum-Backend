import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { AuthService } from "./auth.service";

// Login controller
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

// Refresh token controller
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

// Register controller
const register = catchAsync(async (req: Request, res: Response) => {
	const { name, email, password } = req.body;
	const result = await AuthService.register(name, email, password);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: result.message,
		data: null,
	});
});

// Forgot password controller
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

// Reset password controller
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

// Change password controller
const changePassword = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId;
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

// Verify email controller
const verifyEmail = catchAsync(async (req: Request, res: Response) => {
	const { token } = req.params;
	const result = await AuthService.verifyEmail(token);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: null,
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
