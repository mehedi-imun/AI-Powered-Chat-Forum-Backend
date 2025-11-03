import type { NextFunction, Response } from "express";
import AppError from "../errors/AppError";
import type { AuthRequest } from "./authenticate";

/**
 * Middleware to authorize Organization Owners
 * Allows users with role = "OrgOwner"
 */
export const authorizeOrganizationOwner = (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
) => {
	if (!req.user) {
		throw new AppError(401, "Unauthorized");
	}

	if (req.user.role !== "OrgOwner") {
		throw new AppError(
			403,
			"Forbidden - Requires Organization Owner privileges",
		);
	}

	next();
};
