/**
 * Test utilities and helper functions
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import env from '../../config/env';
import type { IUser } from '../../modules/user/user.interface';
import User from '../../modules/user/user.model';

/**
 * Generate mock JWT token for testing
 */
export const generateTestToken = (
  userId: string | Types.ObjectId,
  role: 'user' | 'admin' = 'user',
): string => {
  const payload = {
    userId: userId.toString(),
    email: 'test@example.com',
    role,
  };

  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h' });
};

/**
 * Create a test user in database
 */
export const createTestUser = async (
  overrides?: Partial<IUser>,
): Promise<IUser> => {
  const hashedPassword = await bcrypt.hash('Test@1234', 12);

  const defaultUser = {
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: hashedPassword,
    role: 'user' as const,
    isVerified: true,
    ...overrides,
  };

  const user = await User.create(defaultUser);
  return user;
};

/**
 * Create a test admin user
 */
export const createTestAdmin = async (): Promise<IUser> => {
  return createTestUser({ role: 'admin' });
};

/**
 * Generate mock ObjectId
 */
export const generateMockObjectId = (): Types.ObjectId => {
  return new Types.ObjectId();
};

/**
 * Wait for specified milliseconds
 */
export const wait = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Mock request with user
 */
export const mockAuthRequest = (
  userId: string | Types.ObjectId,
  role: 'user' | 'admin' = 'user',
) => {
  return {
    user: {
      userId: userId.toString(),
      email: 'test@example.com',
      role,
    },
  };
};

/**
 * Clear all collections
 */
export const clearDatabase = async (): Promise<void> => {
  const collections = await User.db.db?.collections();
  if (collections) {
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  }
};
