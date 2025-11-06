import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import env from "../../config/env";
import type { IUser } from "../../modules/user/user.interface";
import { User } from "../../modules/user/user.model";

export const generateTestToken = (
  userId: string | Types.ObjectId,
  role: "Admin" | "Moderator" | "Member" = "Member"
): string => {
  const payload = {
    userId: userId.toString(),
    email: "test@example.com",
    role,
  };

  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "1h" });
};

export const generateTestRefreshToken = (
  userId: string | Types.ObjectId,
  role: "Admin" | "Moderator" | "Member" = "Member"
): string => {
  const payload = {
    userId: userId.toString(),
    email: "test@example.com",
    role,
  };

  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
};

export const createTestUser = async (
  overrides?: Partial<IUser>
): Promise<IUser> => {
  const defaultUser = {
    name: `Test User ${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: "Test@1234", // Will be hashed by pre-save hook
    role: "Member" as const,
    isActive: true,
    emailVerified: true,
    ...overrides,
  };

  const user = await User.create(defaultUser);
  return user;
};

export const createTestAdmin = async (): Promise<IUser> => {
  return createTestUser({ role: "Admin" });
};

export const generateMockObjectId = (): Types.ObjectId => {
  return new Types.ObjectId();
};

export const wait = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const mockAuthRequest = (
  userId: string | Types.ObjectId,
  role: "Admin" | "Moderator" | "Member" = "Member"
) => {
  return {
    user: {
      userId: userId.toString(),
      email: "test@example.com",
      role,
    },
  };
};

export const clearDatabase = async (): Promise<void> => {
  const collections = await User.db.db?.collections();
  if (collections) {
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  }
};
