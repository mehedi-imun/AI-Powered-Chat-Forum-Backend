/**
 * Resource Ownership Authorization Middleware
 * 
 * Ensures users can only modify/delete their own resources.
 * Admins and Moderators can override ownership checks.
 */

import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import AppError from '../errors/AppError';
import catchAsync from '../utils/catchAsync';

/**
 * Check if user owns the resource or has admin/moderator privileges
 * 
 * @param model - Mongoose model to check ownership against
 * @param resourceIdParam - Request parameter name containing resource ID (default: 'id')
 * @param ownerField - Field name in the model that contains owner ID (default: 'createdBy')
 * @returns Express middleware function
 */
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

			// Admins and Moderators bypass ownership checks
			if (userRole === 'Admin' || userRole === 'Moderator') {
				return next();
			}

			// Validate resource ID
			if (!mongoose.Types.ObjectId.isValid(resourceId)) {
				throw new AppError(400, 'Invalid resource ID');
			}

			// Find the resource
			const resource = await model.findById(resourceId).select(ownerField);

			if (!resource) {
				throw new AppError(404, 'Resource not found');
			}

			// Check ownership
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

/**
 * Check if user owns their own profile
 * Special case for user profile updates
 * 
 * @returns Express middleware function
 */
export const authorizeOwnProfile = catchAsync(
	async (req: Request, res: Response, next: NextFunction) => {
		const profileUserId = req.params.id;
		const currentUserId = req.user!.userId;
		const userRole = req.user!.role;

		// Admins can edit any profile
		if (userRole === 'Admin') {
			return next();
		}

		// Users can only edit their own profile
		if (profileUserId !== currentUserId) {
			throw new AppError(403, 'Access denied. You can only edit your own profile.');
		}

		next();
	},
);

/**
 * Check if user owns a specific field in their request body
 * Useful for preventing users from modifying other users' data
 * 
 * @param fieldName - Name of the field in request body to check
 * @returns Express middleware function
 */
export const authorizeOwnData = (fieldName: string) => {
	return catchAsync(
		async (req: Request, res: Response, next: NextFunction) => {
			const requestedUserId = req.body[fieldName];
			const currentUserId = req.user!.userId;
			const userRole = req.user!.role;

			// Admins and Moderators bypass checks
			if (userRole === 'Admin' || userRole === 'Moderator') {
				return next();
			}

			// If field is provided, it must match current user
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
