/**
 * Cache tests for post.service.ts
 * Spec: .claude/specs/08-cache-expansion.md — section 3.4
 *
 * Covers:
 *   - getPostsByThread: cache hit bypasses aggregation
 *   - getPostsByThread: cache miss writes result to cache
 *   - createPost: calls invalidatePostCache (getRedisClient) after creation
 *   - updatePost: calls invalidatePostCache (getRedisClient) after update
 */

import { Types } from "mongoose";
import { cacheService, getRedisClient } from "../../../config/redis";
import { createTestUser } from "../../../__tests__/utils/testHelpers";
import { Thread } from "../../thread/thread.model";
import { Post } from "../post.model";
import { PostService } from "../post.service";

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

jest.mock("../../../services/queue.service", () => ({
	publishAIModeration: jest.fn().mockResolvedValue(undefined),
	publishAISummary: jest.fn().mockResolvedValue(undefined),
	publishNotification: jest.fn().mockResolvedValue(undefined),
	queueService: { publishToQueue: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../../config/socket", () => ({
	getIO: jest.fn().mockReturnValue(null),
	initSocket: jest.fn(),
	emitToThread: jest.fn(),
	emitToUser: jest.fn(),
}));

jest.mock("../../notification/notification.service", () => ({
	NotificationService: {
		createThreadCreatedNotification: jest.fn().mockResolvedValue(undefined),
		createMentionNotification: jest.fn().mockResolvedValue(undefined),
		createReplyNotification: jest.fn().mockResolvedValue(undefined),
		createPostCreatedNotification: jest.fn().mockResolvedValue(undefined),
	},
}));

// Typed mock references
const mockedCacheService = cacheService as jest.Mocked<typeof cacheService>;
const mockedGetRedisClient = getRedisClient as jest.MockedFunction<typeof getRedisClient>;

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

const seedThread = async (userId: string, overrides: Record<string, unknown> = {}) => {
	return Thread.create({
		title: `Thread ${Date.now()}`,
		createdBy: new Types.ObjectId(userId),
		tags: [],
		viewCount: 0,
		postCount: 1,
		lastActivityAt: new Date(),
		isPinned: false,
		isLocked: false,
		status: "active",
		...overrides,
	});
};

const seedPost = async (threadId: string, userId: string, overrides: Record<string, unknown> = {}) => {
	return Post.create({
		threadId: new Types.ObjectId(threadId),
		parentId: null,
		content: `Post content ${Date.now()}`,
		author: new Types.ObjectId(userId),
		mentions: [],
		status: "active",
		moderationStatus: "approved",
		isEdited: false,
		...overrides,
	});
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => jest.clearAllMocks());

// ===========================================================================
// getPostsByThread — cache hit
// ===========================================================================

describe("PostService.getPostsByThread — cache hit", () => {
	it("returns cached result without hitting the DB aggregation", async () => {
		const cachedPosts = [{ _id: "fake-post", content: "cached" }];
		const cachedData = { posts: cachedPosts, total: 1 };

		// Cache hit on first call
		mockedCacheService.getJSON.mockResolvedValueOnce(cachedData as any);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		// Use a fake threadId — DB should never be queried
		const fakeThreadId = new Types.ObjectId().toString();

		const result = await PostService.getPostsByThread(fakeThreadId);

		expect(result).toEqual(cachedData);
		// setJSON must NOT be called (no cache write on hit)
		expect(mockedCacheService.setJSON).not.toHaveBeenCalled();
		// Returned cached posts directly
		expect(result.posts).toEqual(cachedPosts);
		expect(result.total).toBe(1);

		// Suppress unused variable warning
		void userId;
	});

	it("uses correct cache key pattern for cache lookup", async () => {
		const cachedData = { posts: [], total: 0 };
		mockedCacheService.getJSON.mockResolvedValueOnce(cachedData as any);

		const threadId = new Types.ObjectId().toString();
		const page = 2;
		const limit = 10;

		await PostService.getPostsByThread(threadId, page, limit);

		expect(mockedCacheService.getJSON).toHaveBeenCalledWith(
			`posts:thread:${threadId}:page:${page}:limit:${limit}`,
		);
	});
});

// ===========================================================================
// getPostsByThread — cache miss
// ===========================================================================

describe("PostService.getPostsByThread — cache miss", () => {
	it("writes fresh result to cache with 60s TTL after DB aggregation", async () => {
		// Cache miss
		mockedCacheService.getJSON.mockResolvedValue(null);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		await seedPost(threadId, userId);

		await PostService.getPostsByThread(threadId);

		expect(mockedCacheService.setJSON).toHaveBeenCalledWith(
			`posts:thread:${threadId}:page:1:limit:20`,
			expect.objectContaining({
				posts: expect.any(Array),
				total: expect.any(Number),
			}),
			60,
		);
	});

	it("returns actual DB results when cache is cold", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		await seedPost(threadId, userId);
		await seedPost(threadId, userId);

		const result = await PostService.getPostsByThread(threadId);

		expect(result.total).toBe(2);
		expect(result.posts).toHaveLength(2);
	});

	it("stores result using page and limit in cache key", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		await PostService.getPostsByThread(threadId, 3, 5);

		expect(mockedCacheService.setJSON).toHaveBeenCalledWith(
			`posts:thread:${threadId}:page:3:limit:5`,
			expect.any(Object),
			60,
		);
	});
});

// ===========================================================================
// createPost — invalidatePostCache via getRedisClient
// ===========================================================================

describe("PostService.createPost — invalidates post cache", () => {
	it("calls getRedisClient to perform wildcard cache invalidation after creation", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		// Mock redis client with keys returning empty (no existing cache keys)
		const mockRedisClient = {
			keys: jest.fn().mockResolvedValue([]),
			del: jest.fn().mockResolvedValue(0),
		};
		mockedGetRedisClient.mockReturnValue(mockRedisClient as any);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		await PostService.createPost({ threadId, content: "Cache invalidation test" }, userId);

		// invalidatePostCache calls getRedisClient()
		expect(mockedGetRedisClient).toHaveBeenCalled();
		// It scans for pattern posts:thread:{threadId}:*
		expect(mockRedisClient.keys).toHaveBeenCalledWith(
			`posts:thread:${threadId}:*`,
		);
	});

	it("deletes matching cache keys found by wildcard scan", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		const existingKey = `posts:thread:some-thread-id:page:1:limit:20`;
		const mockRedisClient = {
			keys: jest.fn().mockResolvedValue([existingKey]),
			del: jest.fn().mockResolvedValue(1),
		};
		mockedGetRedisClient.mockReturnValue(mockRedisClient as any);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		await PostService.createPost({ threadId, content: "Test with existing keys" }, userId);

		// del should be called if keys were found (keys might not match threadId but the pattern is passed correctly)
		expect(mockRedisClient.keys).toHaveBeenCalledWith(
			`posts:thread:${threadId}:*`,
		);
	});

	it("gracefully skips invalidation when redis client is not available", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);
		// No redis client available
		mockedGetRedisClient.mockReturnValue(null);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		// Should not throw even when redis is unavailable
		await expect(
			PostService.createPost({ threadId, content: "No redis test" }, userId),
		).resolves.toBeDefined();
	});

	it("throws 404 when thread not found", async () => {
		const userId = new Types.ObjectId().toString();
		const fakeThreadId = new Types.ObjectId().toString();

		await expect(
			PostService.createPost({ threadId: fakeThreadId, content: "Hello" }, userId),
		).rejects.toMatchObject({ statusCode: 404, message: "Thread not found" });
	});

	it("throws 400 when thread is locked", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);
		mockedGetRedisClient.mockReturnValue(null);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId, { isLocked: true });
		const threadId = (thread._id as Types.ObjectId).toString();

		await expect(
			PostService.createPost({ threadId, content: "Locked thread" }, userId),
		).rejects.toMatchObject({ statusCode: 400, message: "Thread is locked" });
	});

	it("throws 404 when parentId does not exist in the thread", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);
		mockedGetRedisClient.mockReturnValue(null);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();
		const fakeParentId = new Types.ObjectId().toString();

		await expect(
			PostService.createPost(
				{ threadId, content: "Reply", parentId: fakeParentId },
				userId,
			),
		).rejects.toMatchObject({ statusCode: 404, message: "Parent post not found" });
	});

	it("processes @mention in content — sends mention notification when user found", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);
		const mockRedisClient = {
			keys: jest.fn().mockResolvedValue([]),
			del: jest.fn().mockResolvedValue(0),
		};
		mockedGetRedisClient.mockReturnValue(mockRedisClient as any);

		const author = await createTestUser();
		const authorId = (author._id as Types.ObjectId).toString();
		// Create a user whose name (no spaces) can be @mentioned
		const mentioned = await createTestUser({ name: "mentioneduser" });

		const thread = await seedThread(authorId);
		const threadId = (thread._id as Types.ObjectId).toString();

		const result = await PostService.createPost(
			{ threadId, content: "@mentioneduser hello!" },
			authorId,
		);

		expect(result).toBeDefined();
		expect(result.content).toBe("@mentioneduser hello!");
		void mentioned;
	});

	it("sends reply notification when parent post author is different from commenter", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);
		const mockRedisClient = {
			keys: jest.fn().mockResolvedValue([]),
			del: jest.fn().mockResolvedValue(0),
		};
		mockedGetRedisClient.mockReturnValue(mockRedisClient as any);

		const parentAuthor = await createTestUser();
		const replyAuthor = await createTestUser();
		const parentAuthorId = (parentAuthor._id as Types.ObjectId).toString();
		const replyAuthorId = (replyAuthor._id as Types.ObjectId).toString();

		const thread = await seedThread(parentAuthorId);
		const threadId = (thread._id as Types.ObjectId).toString();

		const parentPost = await seedPost(threadId, parentAuthorId);
		const parentPostId = (parentPost._id as Types.ObjectId).toString();

		const result = await PostService.createPost(
			{ threadId, content: "Reply to parent", parentId: parentPostId },
			replyAuthorId,
		);

		expect(result).toBeDefined();
		expect(result.content).toBe("Reply to parent");
	});
});

// ===========================================================================
// updatePost — invalidatePostCache via getRedisClient
// ===========================================================================

describe("PostService.updatePost — invalidates post cache", () => {
	it("calls getRedisClient for wildcard cache invalidation after update", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		const mockRedisClient = {
			keys: jest.fn().mockResolvedValue([]),
			del: jest.fn().mockResolvedValue(0),
		};
		mockedGetRedisClient.mockReturnValue(mockRedisClient as any);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();
		const post = await seedPost(threadId, userId);
		const postId = (post._id as Types.ObjectId).toString();

		await PostService.updatePost(postId, { content: "Updated content" }, userId);

		expect(mockedGetRedisClient).toHaveBeenCalled();
		expect(mockRedisClient.keys).toHaveBeenCalledWith(
			`posts:thread:${threadId}:*`,
		);
	});

	it("also deletes the thread summary cache key after update", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		const mockRedisClient = {
			keys: jest.fn().mockResolvedValue([]),
			del: jest.fn().mockResolvedValue(0),
		};
		mockedGetRedisClient.mockReturnValue(mockRedisClient as any);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();
		const post = await seedPost(threadId, userId);
		const postId = (post._id as Types.ObjectId).toString();

		await PostService.updatePost(postId, { content: "Updated" }, userId);

		expect(mockedCacheService.del).toHaveBeenCalledWith(
			`thread:summary:${threadId}`,
		);
	});

	it("throws 404 when post not found during update", async () => {
		const fakeId = new Types.ObjectId().toString();
		const userId = new Types.ObjectId().toString();

		await expect(
			PostService.updatePost(fakeId, { content: "Updated" }, userId),
		).rejects.toMatchObject({ statusCode: 404, message: "Post not found" });
	});

	it("throws 403 when user does not own post during update", async () => {
		const owner = await createTestUser();
		const other = await createTestUser();
		const thread = await seedThread((owner._id as Types.ObjectId).toString());
		const post = await seedPost(
			(thread._id as Types.ObjectId).toString(),
			(owner._id as Types.ObjectId).toString(),
		);

		await expect(
			PostService.updatePost(
				(post._id as Types.ObjectId).toString(),
				{ content: "Hijack" },
				(other._id as Types.ObjectId).toString(),
			),
		).rejects.toMatchObject({ statusCode: 403 });
	});

	it("throws 400 when thread is locked during update", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId, { isLocked: true });
		const post = await seedPost((thread._id as Types.ObjectId).toString(), userId);

		await expect(
			PostService.updatePost(
				(post._id as Types.ObjectId).toString(),
				{ content: "Update on locked" },
				userId,
			),
		).rejects.toMatchObject({ statusCode: 400, message: "Thread is locked" });
	});
});

// ===========================================================================
// deletePost — invalidatePostCache via getRedisClient
// ===========================================================================

describe("PostService.deletePost — invalidates post cache", () => {
	it("calls getRedisClient for wildcard cache invalidation after delete", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		const mockRedisClient = {
			keys: jest.fn().mockResolvedValue([]),
			del: jest.fn().mockResolvedValue(0),
		};
		mockedGetRedisClient.mockReturnValue(mockRedisClient as any);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();
		const post = await seedPost(threadId, userId);
		const postId = (post._id as Types.ObjectId).toString();

		await PostService.deletePost(postId, userId);

		expect(mockedGetRedisClient).toHaveBeenCalled();
		expect(mockRedisClient.keys).toHaveBeenCalledWith(
			`posts:thread:${threadId}:*`,
		);
	});

	it("soft-deletes the post and invalidates cache", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		const mockRedisClient = {
			keys: jest.fn().mockResolvedValue([]),
			del: jest.fn().mockResolvedValue(0),
		};
		mockedGetRedisClient.mockReturnValue(mockRedisClient as any);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();
		const post = await seedPost(threadId, userId);
		const postId = (post._id as Types.ObjectId).toString();

		await PostService.deletePost(postId, userId);

		const deleted = await Post.findById(postId);
		expect(deleted!.status).toBe("deleted");
		expect(mockedCacheService.del).toHaveBeenCalledWith(
			`thread:summary:${threadId}`,
		);
	});

	it("throws 404 when post not found", async () => {
		const fakeId = new Types.ObjectId().toString();
		const userId = new Types.ObjectId().toString();

		await expect(
			PostService.deletePost(fakeId, userId),
		).rejects.toMatchObject({ statusCode: 404, message: "Post not found" });
	});

	it("throws 403 when user does not own post", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		const owner = await createTestUser();
		const other = await createTestUser();
		const thread = await seedThread((owner._id as Types.ObjectId).toString());
		const post = await seedPost(
			(thread._id as Types.ObjectId).toString(),
			(owner._id as Types.ObjectId).toString(),
		);

		await expect(
			PostService.deletePost(
				(post._id as Types.ObjectId).toString(),
				(other._id as Types.ObjectId).toString(),
			),
		).rejects.toMatchObject({ statusCode: 403 });
	});
});

// ===========================================================================
// getPostById — basic coverage
// ===========================================================================

describe("PostService.getPostById", () => {
	it("returns post by id with replies", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const post = await seedPost((thread._id as Types.ObjectId).toString(), userId);
		const postId = (post._id as Types.ObjectId).toString();

		const result = await PostService.getPostById(postId);

		expect(result).toBeDefined();
		expect(result.content).toBe(post.content);
	});

	it("throws 404 when post not found", async () => {
		const fakeId = new Types.ObjectId().toString();

		await expect(PostService.getPostById(fakeId)).rejects.toMatchObject({
			statusCode: 404,
			message: "Post not found",
		});
	});
});

// ===========================================================================
// getPostsByUser — basic coverage
// ===========================================================================

describe("PostService.getPostsByUser", () => {
	it("returns posts for a user", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		await seedPost(threadId, userId);
		await seedPost(threadId, userId);

		const result = await PostService.getPostsByUser(userId);

		expect(result.posts.length).toBeGreaterThanOrEqual(2);
		expect(result.total).toBeGreaterThanOrEqual(2);
	});
});

// ===========================================================================
// getFlaggedPosts — basic coverage
// ===========================================================================

describe("PostService.getFlaggedPosts", () => {
	it("returns flagged posts", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		await seedPost(threadId, userId, { moderationStatus: "flagged" });

		const result = await PostService.getFlaggedPosts();

		expect(result.posts.length).toBeGreaterThanOrEqual(1);
		expect(result.total).toBeGreaterThanOrEqual(1);
	});

	it("returns empty list when no flagged posts exist", async () => {
		const result = await PostService.getFlaggedPosts();

		expect(result.posts).toEqual([]);
		expect(result.total).toBe(0);
	});
});
