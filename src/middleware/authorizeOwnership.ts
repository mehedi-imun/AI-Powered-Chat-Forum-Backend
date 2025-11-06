
import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import AppError from '../errors/AppError';
import catchAsync from '../utils/catchAsync';

export const authorizeOwnership = (
	model: mongoose.Model<any>,
	resourceIdParam = 'id',
	ownerField = 'createdBy',
) => {
	return catchAsync(
		async (req: Request, res: Response, next: NextFunction) => {
			const resourceId = req.params[resourceIdParam];
			const userId = req.user!.userId;
			const userRole = req.user!.role;

			if (userRole === 'Admin' || userRole === 'Moderator') {
				return next();
			}

			if (!mongoose.Types.ObjectId.isValid(resourceId)) {
				throw new AppError(400, 'Invalid resource ID');
			}

			const resource = await model.findById(resourceId).select(ownerField);

			if (!resource) {
				throw new AppError(404, 'Resource not found');
			}

			const ownerId = resource[ownerField]?.toString();

			if (ownerId !== userId) {
				throw new AppError(
					403,
					'Access denied. You can only modify your own resources.',
				);
			}

			next();
		},
	);
};

export const authorizeOwnProfile = catchAsync(
	async (req: Request, res: Response, next: NextFunction) => {
		const profileUserId = req.params.id;
		const currentUserId = req.user!.userId;
		const userRole = req.user!.role;

		if (userRole === 'Admin') {
			return next();
		}

		if (profileUserId !== currentUserId) {
			throw new AppError(403, 'Access denied. You can only edit your own profile.');
		}

		next();
	},
);

export const authorizeOwnData = (fieldName: string) => {
	return catchAsync(
		async (req: Request, res: Response, next: NextFunction) => {
			const requestedUserId = req.body[fieldName];
			const currentUserId = req.user!.userId;
			const userRole = req.user!.role;

			if (userRole === 'Admin' || userRole === 'Moderator') {
				return next();
			}

			if (requestedUserId && requestedUserId !== currentUserId) {
				throw new AppError(
					403,
					`Access denied. You cannot set ${fieldName} to another user.`,
				);
			}

			next();
		},
	);
};
