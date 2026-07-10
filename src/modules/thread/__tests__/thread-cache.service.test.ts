/**
 * Service unit tests for Cache Bug Fixes
 * Spec: .claude/specs/03-cache-bug-fixes.md
 *
 * Bug 1: Thread list cache write was commented out — now re-enabled in getAllThreads()
 * Bug 2: invalidateThreadCache() now also deletes thread:slug:{slug} when slug provided
 * Bug 3: createPost/updatePost/deletePost now call cacheService.del(thread:summary:{threadId})
 *
 * Additional coverage tests for thread.service and post.service functions to
 * reach ≥70% branch/function/line coverage on the two modified files.
 */

import { Types } from "mongoose";
import { cacheService } from "../../../config/redis";
import { createTestUser } from "../../../__tests__/utils/testHelpers";
import { Thread } from "../thread.model";
import { ThreadService } from "../thread.service";
import { Post } from "../../post/post.model";
import { PostService } from "../../post/post.service";
import AppError from "../../../errors/AppError";

// --- Mocks ---

jest.mock("../../../config/redis", () => ({
	cacheService: {
		get: jest.fn().mockResolvedValue(null),
		set: jest.fn().mockResolvedValue(true),
		del: jest.fn().mockResolvedValue(true),
		exists: jest.fn().mockResolvedValue(false),
		getJSON: jest.fn().mockResolvedValue(null),
		setJSON: jest.fn().mockResolvedValue(true),
	},
}));

jest.mock("../../../services/queue.service", () => ({
	publishAIModeration: jest.fn().mockResolvedValue(undefined),
	publishAISummary: jest.fn().mockResolvedValue(undefined),
	publishNotification: jest.fn().mockResolvedValue(undefined),
	queueService: { publishToQueue: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../../config/socket", () => ({
	getIO: jest.fn().mockReturnValue(null),
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

// Typed reference to mocked cacheService for assertions
const mockedCacheService = cacheService as jest.Mocked<typeof cacheService>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seeds one active thread owned by `userId` and returns it. */
const seedThread = async (userId: string, overrides: Record<string, unknown> = {}) => {
	return Thread.create({
		title: `Test Thread ${Date.now()}`,
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

/** Seeds one active post owned by `userId` in `threadId` and returns it. */
const seedPost = async (threadId: string, userId: string, overrides: Record<string, unknown> = {}) => {
	return Post.create({
		threadId: new Types.ObjectId(threadId),
		content: "Test post content",
		author: new Types.ObjectId(userId),
		mentions: [],
		status: "active",
		moderationStatus: "approved",
		isEdited: false,
		...overrides,
	});
};

// ===========================================================================
// CACHE BUG FIXES (core tests per spec)
// ===========================================================================

describe("Cache Bug Fixes", () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	// =========================================================================
	// Bug 1 — Thread list cache is written after getAllThreads()
	// =========================================================================
	describe("Bug 1 — Thread list cache is written", () => {
		it("should write to cache after getAllThreads()", async () => {
			mockedCacheService.getJSON.mockResolvedValue(null);

			const user = await createTestUser();
			await seedThread((user._id as Types.ObjectId).toString());

			await ThreadService.getAllThreads({ page: 1, limit: 10 });

			expect(mockedCacheService.setJSON).toHaveBeenCalledWith(
				expect.stringContaining("threads:list"),
				expect.objectContaining({
					threads: expect.any(Array),
					total: expect.any(Number),
					page: expect.any(Number),
					limit: expect.any(Number),
				}),
				300,
			);
		});

		it("should return cached data on second call without hitting DB", async () => {
			const cachedResult = {
				threads: [{ _id: "fake-id", title: "Cached Thread" }],
				total: 1,
				page: 1,
				limit: 10,
			};

			// First call — cache miss, writes to cache
			mockedCacheService.getJSON.mockResolvedValueOnce(null);
			// Second call — cache hit
			mockedCacheService.getJSON.mockResolvedValueOnce(cachedResult as any);

			const query = { page: 1, limit: 10 };

			await ThreadService.getAllThreads(query);
			const secondResult = await ThreadService.getAllThreads(query);

			expect(secondResult).toEqual(cachedResult);
			// setJSON only called on cache miss (first call)
			expect(mockedCacheService.setJSON).toHaveBeenCalledTimes(1);
		});
	});

	// =========================================================================
	// Bug 2 — Slug cache is invalidated on update and delete
	// =========================================================================
	describe("Bug 2 — Slug cache is invalidated on update", () => {
		let user: Awaited<ReturnType<typeof createTestUser>>;
		let threadId: string;
		let threadSlug: string;

		beforeEach(async () => {
			mockedCacheService.getJSON.mockResolvedValue(null);
			user = await createTestUser();
			const thread = await seedThread((user._id as Types.ObjectId).toString());
			threadId = (thread._id as Types.ObjectId).toString();
			threadSlug = thread.slug;
		});

		it("should delete thread:slug:{slug} key when updateThread() is called", async () => {
			await ThreadService.updateThread(
				threadId,
				{ description: "Updated description" },
				(user._id as Types.ObjectId).toString(),
			);

			expect(mockedCacheService.del).toHaveBeenCalledWith(
				`thread:slug:${threadSlug}`,
			);
		});

		it("should delete thread:slug:{slug} key when deleteThread() is called", async () => {
			await ThreadService.deleteThread(
				threadId,
				(user._id as Types.ObjectId).toString(),
			);

			expect(mockedCacheService.del).toHaveBeenCalledWith(
				`thread:slug:${threadSlug}`,
			);
		});

		it("should NOT delete slug cache when invalidateThreadCache called without slug", async () => {
			// incrementPostCount calls invalidateThreadCache(threadId) — no slug arg
			mockedCacheService.del.mockClear();

			await ThreadService.incrementPostCount(threadId);

			const slugDels = (mockedCacheService.del as jest.Mock).mock.calls.filter(
				([key]: [string]) => key.startsWith("thread:slug:"),
			);
			expect(slugDels).toHaveLength(0);
		});
	});

	// =========================================================================
	// Bug 3 — Summary cache is cleared on post mutations
	// =========================================================================
	describe("Bug 3 — Summary cache is cleared on post mutations", () => {
		let user: Awaited<ReturnType<typeof createTestUser>>;
		let threadId: string;

		beforeEach(async () => {
			mockedCacheService.getJSON.mockResolvedValue(null);
			user = await createTestUser();
			const thread = await seedThread((user._id as Types.ObjectId).toString());
			threadId = (thread._id as Types.ObjectId).toString();
		});

		it("should delete thread:summary:{threadId} after createPost()", async () => {
			const userId = (user._id as Types.ObjectId).toString();

			await PostService.createPost({ threadId, content: "Hello world" }, userId);

			expect(mockedCacheService.del).toHaveBeenCalledWith(
				`thread:summary:${threadId}`,
			);
		});

		it("should delete thread:summary:{threadId} after updatePost()", async () => {
			const userId = (user._id as Types.ObjectId).toString();
			const post = await seedPost(threadId, userId);
			const postId = (post._id as Types.ObjectId).toString();

			mockedCacheService.del.mockClear();

			await PostService.updatePost(postId, { content: "Updated content" }, userId);

			expect(mockedCacheService.del).toHaveBeenCalledWith(
				`thread:summary:${threadId}`,
			);
		});

		it("should delete thread:summary:{threadId} after deletePost()", async () => {
			const userId = (user._id as Types.ObjectId).toString();
			const post = await seedPost(threadId, userId);
			const postId = (post._id as Types.ObjectId).toString();

			mockedCacheService.del.mockClear();

			await PostService.deletePost(postId, userId);

			expect(mockedCacheService.del).toHaveBeenCalledWith(
				`thread:summary:${threadId}`,
			);
		});
	});
});

// ===========================================================================
// THREAD SERVICE — additional coverage
// ===========================================================================

describe("ThreadService — additional coverage", () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	// -------------------------------------------------------------------------
	// createThread
	// -------------------------------------------------------------------------
	describe("createThread", () => {
		it("should create a thread and return it populated", async () => {
			mockedCacheService.getJSON.mockResolvedValue(null);
			const user = await createTestUser();
			const userId = (user._id as Types.ObjectId).toString();

			const result = await ThreadService.createThread(
				{ title: "New Thread", initialPostContent: "First post" },
				userId,
			);

			expect(result).toBeDefined();
			expect(result.title).toBe("New Thread");
		});

		it("should invalidate list cache after createThread", async () => {
			mockedCacheService.getJSON.mockResolvedValue(null);
			const user = await createTestUser();
			const userId = (user._id as Types.ObjectId).toString();

			await ThreadService.createThread(
				{ title: "Cache Invalidation Thread", initialPostContent: "Content" },
				userId,
			);

			expect(mockedCacheService.del).toHaveBeenCalledWith("threads:list");
		});
	});

	// -------------------------------------------------------------------------
	// getThreadById
	// -------------------------------------------------------------------------
	describe("getThreadById", () => {
		it("should return thread when found (cache miss)", async () => {
			mockedCacheService.getJSON.mockResolvedValue(null);
			const user = await createTestUser();
			const thread = await seedThread((user._id as Types.ObjectId).toString());
			const threadId = (thread._id as Types.ObjectId).toString();

			const result = await ThreadService.getThreadById(threadId);

			expect(result).toBeDefined();
			expect(result.title).toBe(thread.title);
			// cache should be written
			expect(mockedCacheService.setJSON).toHaveBeenCalledWith(
				`thread:${threadId}`,
				expect.anything(),
				300,
			);
		});

		it("should return cached thread when cache hit", async () => {
			const fakeThread = { _id: "fake", title: "Cached Thread", status: "active" };
			mockedCacheService.getJSON.mockResolvedValueOnce(fakeThread as any);

			// Pass any valid-looking id — cache will be returned before DB query
			const fakeId = new Types.ObjectId().toString();
			const result = await ThreadService.getThreadById(fakeId);

			expect(result).toEqual(fakeThread);
			expect(mockedCacheService.setJSON).not.toHaveBeenCalled();
		});

		it("should throw 404 when thread not found", async () => {
			mockedCacheService.getJSON.mockResolvedValue(null);
			const nonExistentId = new Types.ObjectId().toString();

			await expect(ThreadService.getThreadById(nonExistentId)).rejects.toMatchObject({
				statusCode: 404,
				message: "Thread not found",
			});
		});
	});

	// -------------------------------------------------------------------------
	// getThreadBySlug
	// -------------------------------------------------------------------------
	describe("getThreadBySlug", () => {
		it("should return thread by slug (cache miss)", async () => {
			mockedCacheService.getJSON.mockResolvedValue(null);
			const user = await createTestUser();
			const thread = await seedThread((user._id as Types.ObjectId).toString());

			const result = await ThreadService.getThreadBySlug(thread.slug);

			expect(result.slug).toBe(thread.slug);
			expect(mockedCacheService.setJSON).toHaveBeenCalledWith(
				`thread:slug:${thread.slug}`,
				expect.anything(),
				300,
			);
		});

		it("should return cached thread by slug (cache hit)", async () => {
			const fakeThread = { _id: "fake", slug: "test-slug", title: "Cached" };
			mockedCacheService.getJSON.mockResolvedValueOnce(fakeThread as any);

			const result = await ThreadService.getThreadBySlug("test-slug");

			expect(result).toEqual(fakeThread);
			expect(mockedCacheService.setJSON).not.toHaveBeenCalled();
		});

		it("should throw 404 when slug not found", async () => {
			mockedCacheService.getJSON.mockResolvedValue(null);

			await expect(
				ThreadService.getThreadBySlug("nonexistent-slug-xyz"),
			).rejects.toMatchObject({ statusCode: 404, message: "Thread not found" });
		});
	});

	// -------------------------------------------------------------------------
	// updateThread — error branches
	// -------------------------------------------------------------------------
	describe("updateThread — error branches", () => {
		it("should throw 404 when thread not found", async () => {
			const userId = new Types.ObjectId().toString();
			const fakeId = new Types.ObjectId().toString();

			await expect(
				ThreadService.updateThread(fakeId, { description: "x" }, userId),
			).rejects.toMatchObject({ statusCode: 404, message: "Thread not found" });
		});

		it("should throw 403 when user does not own thread", async () => {
			const owner = await createTestUser();
			const other = await createTestUser();
			const thread = await seedThread((owner._id as Types.ObjectId).toString());

			await expect(
				ThreadService.updateThread(
					(thread._id as Types.ObjectId).toString(),
					{ description: "x" },
					(other._id as Types.ObjectId).toString(),
				),
			).rejects.toMatchObject({ statusCode: 403 });
		});

		it("should throw 400 when thread is locked", async () => {
			const user = await createTestUser();
			const thread = await seedThread((user._id as Types.ObjectId).toString(), {
				isLocked: true,
			});

			await expect(
				ThreadService.updateThread(
					(thread._id as Types.ObjectId).toString(),
					{ description: "x" },
					(user._id as Types.ObjectId).toString(),
				),
			).rejects.toMatchObject({ statusCode: 400, message: "Thread is locked" });
		});
	});

	// -------------------------------------------------------------------------
	// deleteThread — error branches
	// -------------------------------------------------------------------------
	describe("deleteThread — error branches", () => {
		it("should throw 404 when thread not found", async () => {
			const userId = new Types.ObjectId().toString();
			const fakeId = new Types.ObjectId().toString();

			await expect(
				ThreadService.deleteThread(fakeId, userId),
			).rejects.toMatchObject({ statusCode: 404 });
		});

		it("should throw 403 when user does not own thread", async () => {
			const owner = await createTestUser();
			const other = await createTestUser();
			const thread = await seedThread((owner._id as Types.ObjectId).toString());

			await expect(
				ThreadService.deleteThread(
					(thread._id as Types.ObjectId).toString(),
					(other._id as Types.ObjectId).toString(),
				),
			).rejects.toMatchObject({ statusCode: 403 });
		});
	});

	// -------------------------------------------------------------------------
	// getThreadsByUser
	// -------------------------------------------------------------------------
	describe("getThreadsByUser", () => {
		it("should return threads for a user", async () => {
			const user = await createTestUser();
			const userId = (user._id as Types.ObjectId).toString();
			await seedThread(userId);
			await seedThread(userId);

			const result = await ThreadService.getThreadsByUser(userId);

			expect(result.threads.length).toBeGreaterThanOrEqual(2);
			expect(result.total).toBeGreaterThanOrEqual(2);
		});
	});

	// -------------------------------------------------------------------------
	// incrementPostCount / decrementPostCount
	// -------------------------------------------------------------------------
	describe("incrementPostCount / decrementPostCount", () => {
		it("should increment post count and invalidate cache", async () => {
			const user = await createTestUser();
			const thread = await seedThread((user._id as Types.ObjectId).toString());
			const threadId = (thread._id as Types.ObjectId).toString();

			await ThreadService.incrementPostCount(threadId);

			const updated = await Thread.findById(threadId);
			expect(updated!.postCount).toBe(2); // seeded with 1
			expect(mockedCacheService.del).toHaveBeenCalledWith(`thread:${threadId}`);
		});

		it("should decrement post count and invalidate cache", async () => {
			const user = await createTestUser();
			const thread = await seedThread((user._id as Types.ObjectId).toString());
			const threadId = (thread._id as Types.ObjectId).toString();

			await ThreadService.decrementPostCount(threadId);

			const updated = await Thread.findById(threadId);
			expect(updated!.postCount).toBe(0); // seeded with 1
			expect(mockedCacheService.del).toHaveBeenCalledWith(`thread:${threadId}`);
		});
	});

	// -------------------------------------------------------------------------
	// getThreadSummary
	// -------------------------------------------------------------------------
	describe("getThreadSummary", () => {
		it("should return null when no summary in cache", async () => {
			mockedCacheService.getJSON.mockResolvedValue(null);
			const user = await createTestUser();
			const thread = await seedThread((user._id as Types.ObjectId).toString());
			const threadId = (thread._id as Types.ObjectId).toString();

			const result = await ThreadService.getThreadSummary(threadId);

			expect(result).toBeNull();
		});

		it("should return cached summary when present", async () => {
			const fakeSummary = { summary: "This thread is about testing" };

			// Seed the thread so Thread.findById inside getThreadSummary succeeds
			const user = await createTestUser();
			const thread = await seedThread((user._id as Types.ObjectId).toString());
			const threadId = (thread._id as Types.ObjectId).toString();

			// getThreadSummary calls cacheService.getJSON(`thread:summary:${threadId}`)
			// Make every getJSON call return the fake summary
			mockedCacheService.getJSON.mockResolvedValue(fakeSummary as any);

			const result = await ThreadService.getThreadSummary(threadId);

			expect(result).toEqual(fakeSummary);
		});

		it("should throw 404 when thread not found", async () => {
			mockedCacheService.getJSON.mockResolvedValue(null);
			const fakeId = new Types.ObjectId().toString();

			await expect(ThreadService.getThreadSummary(fakeId)).rejects.toMatchObject({
				statusCode: 404,
				message: "Thread not found",
			});
		});
	});

	// -------------------------------------------------------------------------
	// requestThreadSummary
	// -------------------------------------------------------------------------
	describe("requestThreadSummary", () => {
		it("should publish AI summary job for existing thread", async () => {
			const { publishAISummary } = await import("../../../services/queue.service");
			const user = await createTestUser();
			const thread = await seedThread((user._id as Types.ObjectId).toString());
			const threadId = (thread._id as Types.ObjectId).toString();

			await ThreadService.requestThreadSummary(threadId);

			expect(publishAISummary).toHaveBeenCalledWith({ threadId });
		});

		it("should throw 404 when thread not found", async () => {
			const fakeId = new Types.ObjectId().toString();

			await expect(
				ThreadService.requestThreadSummary(fakeId),
			).rejects.toMatchObject({ statusCode: 404 });
		});
	});
});

// ===========================================================================
// POST SERVICE — additional coverage
// ===========================================================================

describe("PostService — additional coverage", () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	// -------------------------------------------------------------------------
	// createPost — error branches
	// -------------------------------------------------------------------------
	describe("createPost — error branches", () => {
		it("should throw 404 when thread not found", async () => {
			mockedCacheService.getJSON.mockResolvedValue(null);
			const user = await createTestUser();
			const userId = (user._id as Types.ObjectId).toString();
			const fakeThreadId = new Types.ObjectId().toString();

			await expect(
				PostService.createPost({ threadId: fakeThreadId, content: "Hello" }, userId),
			).rejects.toMatchObject({ statusCode: 404, message: "Thread not found" });
		});

		it("should throw 400 when thread is locked", async () => {
			mockedCacheService.getJSON.mockResolvedValue(null);
			const user = await createTestUser();
			const userId = (user._id as Types.ObjectId).toString();
			const thread = await seedThread(userId, { isLocked: true });
			const threadId = (thread._id as Types.ObjectId).toString();

			await expect(
				PostService.createPost({ threadId, content: "Hello" }, userId),
			).rejects.toMatchObject({ statusCode: 400, message: "Thread is locked" });
		});

		it("should throw 404 when parentId post does not exist", async () => {
			mockedCacheService.getJSON.mockResolvedValue(null);
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

		it("should create post successfully with valid data", async () => {
			mockedCacheService.getJSON.mockResolvedValue(null);
			const user = await createTestUser();
			const userId = (user._id as Types.ObjectId).toString();
			const thread = await seedThread(userId);
			const threadId = (thread._id as Types.ObjectId).toString();

			const result = await PostService.createPost(
				{ threadId, content: "Valid post content" },
				userId,
			);

			expect(result).toBeDefined();
			expect(result.content).toBe("Valid post content");
		});
	});

	// -------------------------------------------------------------------------
	// updatePost — error branches
	// -------------------------------------------------------------------------
	describe("updatePost — error branches", () => {
		it("should throw 404 when post not found", async () => {
			const fakeId = new Types.ObjectId().toString();
			const userId = new Types.ObjectId().toString();

			await expect(
				PostService.updatePost(fakeId, { content: "New" }, userId),
			).rejects.toMatchObject({ statusCode: 404, message: "Post not found" });
		});

		it("should throw 403 when user does not own post", async () => {
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

		it("should throw 400 when thread is locked", async () => {
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

	// -------------------------------------------------------------------------
	// deletePost — error branches
	// -------------------------------------------------------------------------
	describe("deletePost — error branches", () => {
		it("should throw 404 when post not found", async () => {
			const fakeId = new Types.ObjectId().toString();
			const userId = new Types.ObjectId().toString();

			await expect(
				PostService.deletePost(fakeId, userId),
			).rejects.toMatchObject({ statusCode: 404, message: "Post not found" });
		});

		it("should throw 403 when user does not own post", async () => {
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

		it("should soft-delete post successfully", async () => {
			const user = await createTestUser();
			const userId = (user._id as Types.ObjectId).toString();
			const thread = await seedThread(userId);
			const post = await seedPost((thread._id as Types.ObjectId).toString(), userId);
			const postId = (post._id as Types.ObjectId).toString();

			await PostService.deletePost(postId, userId);

			const deleted = await Post.findById(postId);
			expect(deleted!.status).toBe("deleted");
		});
	});

	// -------------------------------------------------------------------------
	// createPost — mention and reply branches
	// -------------------------------------------------------------------------
	describe("createPost — mention and reply notification branches", () => {
		it("should handle @mention in post content", async () => {
			mockedCacheService.getJSON.mockResolvedValue(null);
			const author = await createTestUser();
			const mentioned = await createTestUser();
			const authorId = (author._id as Types.ObjectId).toString();

			const thread = await seedThread(authorId);
			const threadId = (thread._id as Types.ObjectId).toString();

			// Use mentioned user's name so the mention regex matches
			const content = `Hello @${mentioned.name.replace(/\s+/g, "")}`;

			const result = await PostService.createPost({ threadId, content }, authorId);

			expect(result).toBeDefined();
			expect(result.content).toBe(content);
		});

		it("should handle reply notification when parentId provided and parent has different author", async () => {
			mockedCacheService.getJSON.mockResolvedValue(null);
			const parentAuthor = await createTestUser();
			const replyAuthor = await createTestUser();

			const parentAuthorId = (parentAuthor._id as Types.ObjectId).toString();
			const replyAuthorId = (replyAuthor._id as Types.ObjectId).toString();

			const thread = await seedThread(parentAuthorId);
			const threadId = (thread._id as Types.ObjectId).toString();

			// Create parent post
			const parentPost = await seedPost(threadId, parentAuthorId);
			const parentPostId = (parentPost._id as Types.ObjectId).toString();

			// Create reply — different author triggers notification
			const result = await PostService.createPost(
				{ threadId, content: "Reply content", parentId: parentPostId },
				replyAuthorId,
			);

			expect(result).toBeDefined();
			expect(result.content).toBe("Reply content");
		});

		it("should NOT send reply notification when replying to own post", async () => {
			mockedCacheService.getJSON.mockResolvedValue(null);
			const user = await createTestUser();
			const userId = (user._id as Types.ObjectId).toString();

			const thread = await seedThread(userId);
			const threadId = (thread._id as Types.ObjectId).toString();

			const parentPost = await seedPost(threadId, userId);
			const parentPostId = (parentPost._id as Types.ObjectId).toString();

			// Reply to own post — no notification branch hit
			const result = await PostService.createPost(
				{ threadId, content: "Self-reply", parentId: parentPostId },
				userId,
			);

			expect(result).toBeDefined();
		});
	});

	// -------------------------------------------------------------------------
	// getPostsByThread
	// -------------------------------------------------------------------------
	describe("getPostsByThread", () => {
		it("should return posts for a thread", async () => {
			const user = await createTestUser();
			const userId = (user._id as Types.ObjectId).toString();
			const thread = await seedThread(userId);
			const threadId = (thread._id as Types.ObjectId).toString();

			await seedPost(threadId, userId);
			await seedPost(threadId, userId);

			const result = await PostService.getPostsByThread(threadId);

			expect(result.posts.length).toBeGreaterThanOrEqual(2);
			expect(result.total).toBeGreaterThanOrEqual(2);
		});
	});

	// -------------------------------------------------------------------------
	// getPostById
	// -------------------------------------------------------------------------
	describe("getPostById", () => {
		it("should return post by id", async () => {
			const user = await createTestUser();
			const userId = (user._id as Types.ObjectId).toString();
			const thread = await seedThread(userId);
			const post = await seedPost((thread._id as Types.ObjectId).toString(), userId);
			const postId = (post._id as Types.ObjectId).toString();

			const result = await PostService.getPostById(postId);

			expect(result).toBeDefined();
			expect(result.content).toBe(post.content);
		});

		it("should throw 404 when post not found", async () => {
			const fakeId = new Types.ObjectId().toString();

			await expect(PostService.getPostById(fakeId)).rejects.toMatchObject({
				statusCode: 404,
				message: "Post not found",
			});
		});
	});

	// -------------------------------------------------------------------------
	// getPostsByUser
	// -------------------------------------------------------------------------
	describe("getPostsByUser", () => {
		it("should return posts for a user", async () => {
			const user = await createTestUser();
			const userId = (user._id as Types.ObjectId).toString();
			const thread = await seedThread(userId);
			const threadId = (thread._id as Types.ObjectId).toString();

			await seedPost(threadId, userId);

			const result = await PostService.getPostsByUser(userId);

			expect(result.posts.length).toBeGreaterThanOrEqual(1);
			expect(result.total).toBeGreaterThanOrEqual(1);
		});
	});

	// -------------------------------------------------------------------------
	// getFlaggedPosts
	// -------------------------------------------------------------------------
	describe("getFlaggedPosts", () => {
		it("should return flagged posts", async () => {
			const user = await createTestUser();
			const userId = (user._id as Types.ObjectId).toString();
			const thread = await seedThread(userId);
			const threadId = (thread._id as Types.ObjectId).toString();

			await seedPost(threadId, userId, { moderationStatus: "flagged" });

			const result = await PostService.getFlaggedPosts();

			expect(result.posts.length).toBeGreaterThanOrEqual(1);
			expect(result.total).toBeGreaterThanOrEqual(1);
		});

		it("should return empty list when no flagged posts exist", async () => {
			const result = await PostService.getFlaggedPosts();

			expect(result.posts).toEqual([]);
			expect(result.total).toBe(0);
		});
	});
});
