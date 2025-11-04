/**
 * Unit Tests for Ownership Authorization Middleware
 * 
 * Tests resource ownership checks and access control
 */

import type { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { authorizeOwnership, authorizeOwnProfile, authorizeOwnData } from '../authorizeOwnership';
import AppError from '../../errors/AppError';

// Mock user model for testing
const MockModel = mongoose.model(
	'MockResource',
	new mongoose.Schema({
		createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		content: String,
	}),
);

// Mock request, response, next
const mockRequest = (params: any, user: any, body: any = {}) => ({
	params,
	user,
	body,
});

const mockResponse = () => {
	const res: Partial<Response> = {};
	res.status = jest.fn().mockReturnValue(res);
	res.json = jest.fn().mockReturnValue(res);
	return res as Response;
};

const mockNext = jest.fn() as NextFunction;

describe('Authorization Ownership Middleware', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('authorizeOwnership', () => {
		const userId = new mongoose.Types.ObjectId().toString();
		const resourceId = new mongoose.Types.ObjectId().toString();
		const ownerId = new mongoose.Types.ObjectId().toString();

		it('should allow admin to access any resource', async () => {
			const req = mockRequest(
				{ id: resourceId },
				{ userId, role: 'Admin' },
			) as any;
			const res = mockResponse();
			const next = jest.fn();

			const middleware = authorizeOwnership(MockModel);
			await middleware(req, res, next);

			expect(next).toHaveBeenCalled();
		});

		it('should allow moderator to access any resource', async () => {
			const req = mockRequest(
				{ id: resourceId },
				{ userId, role: 'Moderator' },
			) as any;
			const res = mockResponse();
			const next = jest.fn();

			const middleware = authorizeOwnership(MockModel);
			await middleware(req, res, next);

			expect(next).toHaveBeenCalled();
		});

		it('should throw error for invalid resource ID', async () => {
			const req = mockRequest(
				{ id: 'invalid-id' },
				{ userId, role: 'Member' },
			) as any;
			const res = mockResponse();
			const next = jest.fn();

			const middleware = authorizeOwnership(MockModel);

			await expect(middleware(req, res, next)).rejects.toThrow(AppError);
			await expect(middleware(req, res, next)).rejects.toThrow('Invalid resource ID');
		});

		it('should throw error if resource not found', async () => {
			const req = mockRequest(
				{ id: resourceId },
				{ userId, role: 'Member' },
			) as any;
			const res = mockResponse();
			const next = jest.fn();

			// Mock findById to return null
			jest.spyOn(MockModel, 'findById').mockReturnValue({
				select: jest.fn().mockResolvedValue(null),
			} as any);

			const middleware = authorizeOwnership(MockModel);

			await expect(middleware(req, res, next)).rejects.toThrow(AppError);
			await expect(middleware(req, res, next)).rejects.toThrow('Resource not found');
		});

		it('should throw error if user does not own resource', async () => {
			const req = mockRequest(
				{ id: resourceId },
				{ userId, role: 'Member' },
			) as any;
			const res = mockResponse();
			const next = jest.fn();

			// Mock findById to return resource with different owner
			jest.spyOn(MockModel, 'findById').mockReturnValue({
				select: jest.fn().mockResolvedValue({ createdBy: ownerId }),
			} as any);

			const middleware = authorizeOwnership(MockModel);

			await expect(middleware(req, res, next)).rejects.toThrow(AppError);
			await expect(middleware(req, res, next)).rejects.toThrow(
				'Access denied. You can only modify your own resources.',
			);
		});

		it('should allow user to access their own resource', async () => {
			const req = mockRequest(
				{ id: resourceId },
				{ userId, role: 'Member' },
			) as any;
			const res = mockResponse();
			const next = jest.fn();

			// Mock findById to return resource owned by user
			jest.spyOn(MockModel, 'findById').mockReturnValue({
				select: jest.fn().mockResolvedValue({ createdBy: userId }),
			} as any);

			const middleware = authorizeOwnership(MockModel);
			await middleware(req, res, next);

			expect(next).toHaveBeenCalled();
		});
	});

	describe('authorizeOwnProfile', () => {
		const userId = new mongoose.Types.ObjectId().toString();
		const otherUserId = new mongoose.Types.ObjectId().toString();

		it('should allow admin to edit any profile', async () => {
			const req = mockRequest(
				{ id: otherUserId },
				{ userId, role: 'Admin' },
			) as any;
			const res = mockResponse();
			const next = jest.fn();

			await authorizeOwnProfile(req, res, next);

			expect(next).toHaveBeenCalled();
		});

		it('should allow user to edit their own profile', async () => {
			const req = mockRequest(
				{ id: userId },
				{ userId, role: 'Member' },
			) as any;
			const res = mockResponse();
			const next = jest.fn();

			await authorizeOwnProfile(req, res, next);

			expect(next).toHaveBeenCalled();
		});

		it('should deny user from editing other profiles', async () => {
			const req = mockRequest(
				{ id: otherUserId },
				{ userId, role: 'Member' },
			) as any;
			const res = mockResponse();
			const next = jest.fn();

			await expect(authorizeOwnProfile(req, res, next)).rejects.toThrow(AppError);
			await expect(authorizeOwnProfile(req, res, next)).rejects.toThrow(
				'Access denied. You can only edit your own profile.',
			);
		});
	});

	describe('authorizeOwnData', () => {
		const userId = new mongoose.Types.ObjectId().toString();
		const otherUserId = new mongoose.Types.ObjectId().toString();

		it('should allow admin to set any user ID', async () => {
			const req = mockRequest(
				{},
				{ userId, role: 'Admin' },
				{ authorId: otherUserId },
			) as any;
			const res = mockResponse();
			const next = jest.fn();

			const middleware = authorizeOwnData('authorId');
			await middleware(req, res, next);

			expect(next).toHaveBeenCalled();
		});

		it('should allow moderator to set any user ID', async () => {
			const req = mockRequest(
				{},
				{ userId, role: 'Moderator' },
				{ authorId: otherUserId },
			) as any;
			const res = mockResponse();
			const next = jest.fn();

			const middleware = authorizeOwnData('authorId');
			await middleware(req, res, next);

			expect(next).toHaveBeenCalled();
		});

		it('should allow user to set their own ID', async () => {
			const req = mockRequest(
				{},
				{ userId, role: 'Member' },
				{ authorId: userId },
			) as any;
			const res = mockResponse();
			const next = jest.fn();

			const middleware = authorizeOwnData('authorId');
			await middleware(req, res, next);

			expect(next).toHaveBeenCalled();
		});

		it('should deny user from setting another user ID', async () => {
			const req = mockRequest(
				{},
				{ userId, role: 'Member' },
				{ authorId: otherUserId },
			) as any;
			const res = mockResponse();
			const next = jest.fn();

			const middleware = authorizeOwnData('authorId');

			await expect(middleware(req, res, next)).rejects.toThrow(AppError);
			await expect(middleware(req, res, next)).rejects.toThrow(
				'Access denied. You cannot set authorId to another user.',
			);
		});

		it('should allow request without the field', async () => {
			const req = mockRequest(
				{},
				{ userId, role: 'Member' },
				{}, // No authorId field
			) as any;
			const res = mockResponse();
			const next = jest.fn();

			const middleware = authorizeOwnData('authorId');
			await middleware(req, res, next);

			expect(next).toHaveBeenCalled();
		});
	});
});
