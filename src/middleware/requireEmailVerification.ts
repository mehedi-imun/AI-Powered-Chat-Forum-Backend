import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import AppError from "../errors/AppError";

const requireEmailVerification = (
	req: Request,
	_res: Response,
	next: NextFunction,
) => {
	const user = req.user;

	if (!user) {
		throw new AppError(httpStatus.UNAUTHORIZED, "User not authenticated");
	}

	if (!user.emailVerified) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Please verify your email address to perform this action. Check your inbox for the verification email.",
		);
	}

	next();
};

export default requireEmailVerification;
