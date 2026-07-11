/**
 * Cache tests for user.service.ts
 * Spec: .claude/specs/08-cache-expansion.md — section 3.5
 *
 * Covers:
 *   - getUserById: cache hit bypasses DB query
 *   - getUserById: cache miss writes user to cache with 300s TTL
 *   - updateUser: deletes user cache key after update
 *   - deleteUser: deletes user cache key after delete
 */

import { Types } from "mongoose";
import { cacheService } from "../../../config/redis";
import { createTestUser } from "../../../__tests__/utils/testHelpers";
import { UserService } from "../user.service";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock("../../../config/redis", () => ({
	cacheService: {
		get: jest.fn(),
		set: jest.fn(),
		del: jest.fn().mockResolvedValue(true),
		exists: jest.fn(),
		getJSON: jest.fn(),
		setJSON: jest.fn().mockResolvedValue(true),
	},
	getRedisClient: jest.fn(),
}));

const mockedCacheService = cacheService as jest.Mocked<typeof cacheService>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => jest.clearAllMocks());

// ===========================================================================
// getUserById — cache hit
// ===========================================================================

describe("UserService.getUserById — cache hit", () => {
	it("returns cached user without hitting the database", async () => {
		const fakeUser = {
			_id: new Types.ObjectId().toString(),
			name: "Cached User",
			email: "cached@example.com",
			role: "Member",
		};

		mockedCacheService.getJSON.mockResolvedValueOnce(fakeUser as any);

		const fakeId = new Types.ObjectId().toString();
		const result = await UserService.getUserById(fakeId);

		expect(result).toEqual(fakeUser);
		// No write on cache hit
		expect(mockedCacheService.setJSON).not.toHaveBeenCalled();
	});

	it("checks the correct cache key: user:{userId}", async () => {
		const fakeUser = { _id: "some-id", name: "Test" };
		mockedCacheService.getJSON.mockResolvedValueOnce(fakeUser as any);

		const userId = new Types.ObjectId().toString();
		await UserService.getUserById(userId);

		expect(mockedCacheService.getJSON).toHaveBeenCalledWith(`user:${userId}`);
	});
});

// ===========================================================================
// getUserById — cache miss
// ===========================================================================

describe("UserService.getUserById — cache miss", () => {
	it("writes user to cache with 300s TTL after DB fetch", async () => {
		// Cache miss
		mockedCacheService.getJSON.mockResolvedValue(null);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		await UserService.getUserById(userId);

		expect(mockedCacheService.setJSON).toHaveBeenCalledWith(
			`user:${userId}`,
			expect.objectContaining({ _id: expect.anything() }),
			300,
		);
	});

	it("returns actual user from DB when cache is cold", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		const result = await UserService.getUserById(userId);

		expect(result).toBeDefined();
		expect((result as any).email).toBe(user.email);
	});

	it("throws 404 when user does not exist in DB (and cache is cold)", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		const nonExistentId = new Types.ObjectId().toString();

		await expect(UserService.getUserById(nonExistentId)).rejects.toMatchObject({
			statusCode: 404,
			message: "User not found",
		});
	});

	it("throws 400 for an invalid user ID without touching cache", async () => {
		await expect(UserService.getUserById("not-a-valid-id")).rejects.toMatchObject({
			statusCode: 400,
			message: "Invalid user ID",
		});

		// Cache should not be consulted for an invalid ID (validation happens before)
		expect(mockedCacheService.getJSON).not.toHaveBeenCalled();
	});
});

// ===========================================================================
// updateUser — cache invalidation
// ===========================================================================

describe("UserService.updateUser — cache invalidation", () => {
	it("deletes user cache key after successful update", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		await UserService.updateUser(userId, { name: "New Name" });

		expect(mockedCacheService.del).toHaveBeenCalledWith(`user:${userId}`);
	});

	it("deletes correct cache key for the updated user", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		const user1 = await createTestUser();
		const user2 = await createTestUser();
		const userId1 = (user1._id as Types.ObjectId).toString();
		const userId2 = (user2._id as Types.ObjectId).toString();

		await UserService.updateUser(userId1, { name: "User One Updated" });

		// Only user1's cache should be deleted
		expect(mockedCacheService.del).toHaveBeenCalledWith(`user:${userId1}`);
		expect(mockedCacheService.del).not.toHaveBeenCalledWith(`user:${userId2}`);
	});

	it("returns updated user after cache invalidation", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		const result = await UserService.updateUser(userId, { name: "Fresh Name" });

		expect(result).toBeDefined();
		expect((result as any).name).toBe("Fresh Name");
		expect(mockedCacheService.del).toHaveBeenCalledWith(`user:${userId}`);
	});

	it("throws 404 when user to update is not found, without cache delete", async () => {
		const nonExistentId = new Types.ObjectId().toString();

		await expect(
			UserService.updateUser(nonExistentId, { name: "Ghost" }),
		).rejects.toMatchObject({
			statusCode: 404,
			message: "User not found",
		});

		// del should not be called if user was not found
		expect(mockedCacheService.del).not.toHaveBeenCalled();
	});
});

// ===========================================================================
// deleteUser — cache invalidation
// ===========================================================================

describe("UserService.deleteUser — cache invalidation", () => {
	it("deletes user cache key after successful deletion", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		await UserService.deleteUser(userId);

		expect(mockedCacheService.del).toHaveBeenCalledWith(`user:${userId}`);
	});

	it("deletes correct cache key for the deleted user", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		await UserService.deleteUser(userId);

		expect(mockedCacheService.del).toHaveBeenCalledWith(`user:${userId}`);
		expect(mockedCacheService.del).toHaveBeenCalledTimes(1);
	});

	it("throws 404 when user to delete is not found, without cache delete", async () => {
		const nonExistentId = new Types.ObjectId().toString();

		await expect(
			UserService.deleteUser(nonExistentId),
		).rejects.toMatchObject({
			statusCode: 404,
			message: "User not found",
		});

		// del should not be called when user not found
		expect(mockedCacheService.del).not.toHaveBeenCalled();
	});

	it("throws 400 for invalid user ID without cache delete", async () => {
		await expect(
			UserService.deleteUser("bad-id"),
		).rejects.toMatchObject({
			statusCode: 400,
			message: "Invalid user ID",
		});

		expect(mockedCacheService.del).not.toHaveBeenCalled();
	});
});

// ===========================================================================
// getAllUsers — basic coverage
// ===========================================================================

describe("UserService.getAllUsers", () => {
	it("returns paginated users list", async () => {
		await createTestUser();
		await createTestUser();

		const result = await UserService.getAllUsers({ page: 1, limit: 10 });

		expect(result.users.length).toBeGreaterThanOrEqual(2);
		expect(result.total).toBeGreaterThanOrEqual(2);
		expect(result.page).toBe(1);
		expect(result.limit).toBe(10);
	});

	it("returns empty list when no users exist", async () => {
		const result = await UserService.getAllUsers({ page: 1, limit: 10 });

		expect(result.users).toEqual([]);
	});
});

// ===========================================================================
// getUserByEmail — basic coverage
// ===========================================================================

describe("UserService.getUserByEmail", () => {
	it("returns user by email when found", async () => {
		const user = await createTestUser();

		const result = await UserService.getUserByEmail(user.email);

		expect(result).toBeDefined();
		expect(result!.email).toBe(user.email);
	});

	it("returns null when email not found", async () => {
		const result = await UserService.getUserByEmail("nonexistent@example.com");

		expect(result).toBeNull();
	});
});

// ===========================================================================
// createUser — basic coverage
// ===========================================================================

describe("UserService.createUser", () => {
	it("creates a user with valid data", async () => {
		const email = `newuser_${Date.now()}@example.com`;

		const result = await UserService.createUser({
			name: "New Test User",
			email,
			password: "Test@1234",
		});

		expect(result).toBeDefined();
		expect((result as any).email).toBe(email);
	});

	it("throws 409 when email already exists", async () => {
		const user = await createTestUser();

		await expect(
			UserService.createUser({
				name: "Duplicate User",
				email: user.email,
				password: "Test@1234",
			}),
		).rejects.toMatchObject({
			statusCode: 409,
			message: "User with this email already exists",
		});
	});
});
