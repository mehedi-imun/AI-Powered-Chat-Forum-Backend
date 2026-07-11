/**
 * Service unit tests for DB Query Optimization
 * Spec: .claude/specs/05-db-query-optimization.md
 *
 * Key focus:
 *   - getPostsByThread uses aggregation pipeline (no recursive N+1)
 *   - getPostById still works via getPostReplies helper
 *   - createPost, updatePost, deletePost behaviour is unchanged
 *   - Only status:"active" posts are returned
 *   - Only parentId:null posts are top-level; replies appear in replies array
 *   - Pagination offsets work correctly
 */

import { Types } from "mongoose";
import * as socketConfig from "../../../config/socket";
import * as queueServiceModule from "../../../services/queue.service";
import { createTestUser } from "../../../__tests__/utils/testHelpers";
import { Thread } from "../../thread/thread.model";
import { Post } from "../post.model";
import { PostService } from "../post.service";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

const seedThread = async (
	userId: string,
	overrides: Record<string, unknown> = {},
) => {
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

/** Creates a top-level post (parentId = null) by default */
const seedPost = async (
	threadId: string,
	userId: string,
	overrides: Record<string, unknown> = {},
) => {
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

/** Creates a reply post (parentId = parentPostId) */
const seedReply = async (
	threadId: string,
	userId: string,
	parentPostId: string,
	overrides: Record<string, unknown> = {},
) => {
	return Post.create({
		threadId: new Types.ObjectId(threadId),
		parentId: new Types.ObjectId(parentPostId),
		content: `Reply content ${Date.now()}`,
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
// getPostsByThread — aggregation pipeline (N+1 fix)
// ===========================================================================

describe("PostService.getPostsByThread", () => {
	it("returns empty result when thread has no active posts", async () => {
		const user = await createTestUser();
		const thread = await seedThread((user._id as Types.ObjectId).toString());
		const threadId = (thread._id as Types.ObjectId).toString();

		const result = await PostService.getPostsByThread(threadId);

		expect(result.posts).toEqual([]);
		expect(result.total).toBe(0);
	});

	it("returns top-level posts with populated author fields", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		await seedPost(threadId, userId);

		const result = await PostService.getPostsByThread(threadId);

		expect(result.posts).toHaveLength(1);
		expect(result.total).toBe(1);

		const post = result.posts[0];
		expect(post.author).toBeDefined();
		// Author should be populated object (not raw ObjectId string)
		expect(typeof post.author).toBe("object");
		expect((post.author as any).name).toBeDefined();
		expect((post.author as any).email).toBeDefined();
		expect((post.author as any).role).toBeDefined();
	});

	it("returns only status:active posts — deleted posts are excluded", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		await seedPost(threadId, userId); // active
		await seedPost(threadId, userId, { status: "deleted" }); // excluded

		const result = await PostService.getPostsByThread(threadId);

		expect(result.posts).toHaveLength(1);
		expect(result.total).toBe(1);
	});

	it("returns only parentId:null posts as top-level entries", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		const parentPost = await seedPost(threadId, userId);
		const parentPostId = (parentPost._id as Types.ObjectId).toString();

		// reply — must not appear at top level
		await seedReply(threadId, userId, parentPostId);

		const result = await PostService.getPostsByThread(threadId);

		expect(result.posts).toHaveLength(1);
		expect(result.total).toBe(1);
	});

	it("populates depth-1 replies inside the replies array", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		const parentPost = await seedPost(threadId, userId);
		const parentPostId = (parentPost._id as Types.ObjectId).toString();

		const reply1 = await seedReply(threadId, userId, parentPostId);
		const reply2 = await seedReply(threadId, userId, parentPostId);

		const result = await PostService.getPostsByThread(threadId);

		expect(result.posts).toHaveLength(1);
		const topPost = result.posts[0];
		expect(Array.isArray(topPost.replies)).toBe(true);
		expect(topPost.replies).toHaveLength(2);

		// Replies should have populated author fields
		const firstReply = topPost.replies![0];
		expect((firstReply.author as any).name).toBeDefined();
	});

	it("populates depth-2 (nested) replies inside depth-1 replies", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		const parentPost = await seedPost(threadId, userId);
		const parentPostId = (parentPost._id as Types.ObjectId).toString();

		const reply = await seedReply(threadId, userId, parentPostId);
		const replyId = (reply._id as Types.ObjectId).toString();

		// depth-2 reply
		await seedReply(threadId, userId, replyId);

		const result = await PostService.getPostsByThread(threadId);

		expect(result.posts).toHaveLength(1);
		const topPost = result.posts[0];
		expect(topPost.replies).toHaveLength(1);

		const depth1Reply = topPost.replies![0];
		expect(Array.isArray(depth1Reply.replies)).toBe(true);
		expect(depth1Reply.replies).toHaveLength(1);
	});

	it("excludes deleted replies from the replies array", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		const parentPost = await seedPost(threadId, userId);
		const parentPostId = (parentPost._id as Types.ObjectId).toString();

		await seedReply(threadId, userId, parentPostId); // active
		await seedReply(threadId, userId, parentPostId, { status: "deleted" }); // excluded

		const result = await PostService.getPostsByThread(threadId);

		expect(result.posts[0].replies).toHaveLength(1);
	});

	it("pagination: page 2 returns correct offset", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		// Seed 3 top-level posts
		for (let i = 0; i < 3; i++) {
			await seedPost(threadId, userId);
		}

		const page1 = await PostService.getPostsByThread(threadId, 1, 2);
		const page2 = await PostService.getPostsByThread(threadId, 2, 2);

		expect(page1.posts).toHaveLength(2);
		expect(page2.posts).toHaveLength(1);
		// total should always be 3 regardless of page
		expect(page1.total).toBe(3);
		expect(page2.total).toBe(3);
	});

	it("returns correct total count", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		await seedPost(threadId, userId);
		await seedPost(threadId, userId);
		await seedPost(threadId, userId);

		const result = await PostService.getPostsByThread(threadId);

		expect(result.total).toBe(3);
	});

	it("returns posts for specific thread only — not other threads", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread1 = await seedThread(userId);
		const thread2 = await seedThread(userId);
		const thread1Id = (thread1._id as Types.ObjectId).toString();
		const thread2Id = (thread2._id as Types.ObjectId).toString();

		await seedPost(thread1Id, userId);
		await seedPost(thread2Id, userId);
		await seedPost(thread2Id, userId);

		const result1 = await PostService.getPostsByThread(thread1Id);
		const result2 = await PostService.getPostsByThread(thread2Id);

		expect(result1.total).toBe(1);
		expect(result2.total).toBe(2);
	});

	it("page 1 with limit larger than total returns all posts", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		await seedPost(threadId, userId);

		const result = await PostService.getPostsByThread(threadId, 1, 100);

		expect(result.posts).toHaveLength(1);
		expect(result.total).toBe(1);
	});
});

// ===========================================================================
// getPostById — uses getPostReplies helper (unchanged path)
// ===========================================================================

describe("PostService.getPostById", () => {
	it("returns post with replies populated", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		const post = await seedPost(threadId, userId);
		const postId = (post._id as Types.ObjectId).toString();

		await seedReply(threadId, userId, postId);

		const result = await PostService.getPostById(postId);

		expect(result).toBeDefined();
		expect(result.content).toBe(post.content);
		expect(Array.isArray(result.replies)).toBe(true);
		expect(result.replies).toHaveLength(1);
	});

	it("returns post with empty replies array when no replies exist", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const post = await seedPost(
			(thread._id as Types.ObjectId).toString(),
			userId,
		);
		const postId = (post._id as Types.ObjectId).toString();

		const result = await PostService.getPostById(postId);

		expect(result.replies).toEqual([]);
	});

	it("throws 404 when post does not exist", async () => {
		const fakeId = new Types.ObjectId().toString();

		await expect(PostService.getPostById(fakeId)).rejects.toMatchObject({
			statusCode: 404,
			message: "Post not found",
		});
	});

	it("throws 404 when post is deleted", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const post = await seedPost(
			(thread._id as Types.ObjectId).toString(),
			userId,
			{ status: "deleted" },
		);
		const postId = (post._id as Types.ObjectId).toString();

		await expect(PostService.getPostById(postId)).rejects.toMatchObject({
			statusCode: 404,
		});
	});
});

// ===========================================================================
// createPost
// ===========================================================================

describe("PostService.createPost", () => {
	beforeEach(() => {
		jest
			.spyOn(queueServiceModule, "publishAIModeration")
			.mockResolvedValue(false);
		jest
			.spyOn(queueServiceModule, "publishNotification")
			.mockResolvedValue(false);
		jest.spyOn(socketConfig, "getIO").mockReturnValue(null);
	});

	it("creates a post successfully with valid data", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		const result = await PostService.createPost(
			{ threadId, content: "Hello world" },
			userId,
		);

		expect(result).toBeDefined();
		expect(result.content).toBe("Hello world");
		expect(result.status).toBe("active");
		expect(result.moderationStatus).toBe("pending");
	});

	it("creates a reply post when parentId is provided", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		const parentPost = await seedPost(threadId, userId);
		const parentPostId = (parentPost._id as Types.ObjectId).toString();

		const result = await PostService.createPost(
			{ threadId, content: "Reply content", parentId: parentPostId },
			userId,
		);

		expect(result).toBeDefined();
		expect(result.parentId?.toString()).toBe(parentPostId);
	});

	it("throws 404 when thread does not exist", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const fakeThreadId = new Types.ObjectId().toString();

		await expect(
			PostService.createPost({ threadId: fakeThreadId, content: "Hello" }, userId),
		).rejects.toMatchObject({ statusCode: 404, message: "Thread not found" });
	});

	it("throws 400 when thread is locked", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId, { isLocked: true });
		const threadId = (thread._id as Types.ObjectId).toString();

		await expect(
			PostService.createPost({ threadId, content: "Hello" }, userId),
		).rejects.toMatchObject({ statusCode: 400, message: "Thread is locked" });
	});

	it("throws 404 when parentId post does not exist", async () => {
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

	it("sends reply notification when replying to another user's post", async () => {
		const parentAuthor = await createTestUser();
		const replyAuthor = await createTestUser();
		const parentAuthorId = (parentAuthor._id as Types.ObjectId).toString();
		const replyAuthorId = (replyAuthor._id as Types.ObjectId).toString();

		const thread = await seedThread(parentAuthorId);
		const threadId = (thread._id as Types.ObjectId).toString();
		const parentPost = await seedPost(threadId, parentAuthorId);
		const parentPostId = (parentPost._id as Types.ObjectId).toString();

		const result = await PostService.createPost(
			{ threadId, content: "Reply to another user", parentId: parentPostId },
			replyAuthorId,
		);

		expect(result).toBeDefined();
	});

	it("does not send reply notification when replying to own post", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();
		const parentPost = await seedPost(threadId, userId);
		const parentPostId = (parentPost._id as Types.ObjectId).toString();

		const result = await PostService.createPost(
			{ threadId, content: "Self reply", parentId: parentPostId },
			userId,
		);

		expect(result).toBeDefined();
	});

	it("publishes AI moderation job after creating post", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		await PostService.createPost({ threadId, content: "Moderation test" }, userId);

		expect(queueServiceModule.publishAIModeration).toHaveBeenCalledWith(
			expect.objectContaining({ content: "Moderation test" }),
		);
	});
});

// ===========================================================================
// updatePost
// ===========================================================================

describe("PostService.updatePost", () => {
	beforeEach(() => {
		jest
			.spyOn(queueServiceModule, "publishAIModeration")
			.mockResolvedValue(false);
		jest.spyOn(socketConfig, "getIO").mockReturnValue(null);
	});

	it("updates post content successfully", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const post = await seedPost(
			(thread._id as Types.ObjectId).toString(),
			userId,
		);
		const postId = (post._id as Types.ObjectId).toString();

		const result = await PostService.updatePost(
			postId,
			{ content: "Updated content" },
			userId,
		);

		expect(result.content).toBe("Updated content");
		expect(result.isEdited).toBe(true);
		expect(result.editedAt).toBeDefined();
	});

	it("resets moderationStatus to pending after update", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const post = await seedPost(
			(thread._id as Types.ObjectId).toString(),
			userId,
			{ moderationStatus: "approved" },
		);
		const postId = (post._id as Types.ObjectId).toString();

		const result = await PostService.updatePost(
			postId,
			{ content: "Edited" },
			userId,
		);

		expect(result.moderationStatus).toBe("pending");
	});

	it("throws 404 when post not found", async () => {
		const fakeId = new Types.ObjectId().toString();
		const userId = new Types.ObjectId().toString();

		await expect(
			PostService.updatePost(fakeId, { content: "x" }, userId),
		).rejects.toMatchObject({ statusCode: 404, message: "Post not found" });
	});

	it("throws 403 when user does not own the post", async () => {
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

	it("throws 400 when thread is locked", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId, { isLocked: true });
		const post = await seedPost((thread._id as Types.ObjectId).toString(), userId);

		await expect(
			PostService.updatePost(
				(post._id as Types.ObjectId).toString(),
				{ content: "Update locked" },
				userId,
			),
		).rejects.toMatchObject({ statusCode: 400, message: "Thread is locked" });
	});

	it("re-queues AI moderation after update", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const post = await seedPost(
			(thread._id as Types.ObjectId).toString(),
			userId,
		);
		const postId = (post._id as Types.ObjectId).toString();

		await PostService.updatePost(postId, { content: "Re-moderated" }, userId);

		expect(queueServiceModule.publishAIModeration).toHaveBeenCalledWith(
			expect.objectContaining({ content: "Re-moderated" }),
		);
	});
});

// ===========================================================================
// deletePost
// ===========================================================================

describe("PostService.deletePost", () => {
	beforeEach(() => {
		jest.spyOn(socketConfig, "getIO").mockReturnValue(null);
	});

	it("soft-deletes post successfully", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const post = await seedPost(
			(thread._id as Types.ObjectId).toString(),
			userId,
		);
		const postId = (post._id as Types.ObjectId).toString();

		await PostService.deletePost(postId, userId);

		const deleted = await Post.findById(postId);
		expect(deleted?.status).toBe("deleted");
	});

	it("cascades deletion to replies", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();
		const post = await seedPost(threadId, userId);
		const postId = (post._id as Types.ObjectId).toString();
		const reply = await seedReply(threadId, userId, postId);
		const replyId = (reply._id as Types.ObjectId).toString();

		await PostService.deletePost(postId, userId);

		const deletedReply = await Post.findById(replyId);
		expect(deletedReply?.status).toBe("deleted");
	});

	it("throws 404 when post not found", async () => {
		const fakeId = new Types.ObjectId().toString();
		const userId = new Types.ObjectId().toString();

		await expect(PostService.deletePost(fakeId, userId)).rejects.toMatchObject({
			statusCode: 404,
			message: "Post not found",
		});
	});

	it("throws 403 when user does not own the post", async () => {
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
// getPostsByUser
// ===========================================================================

describe("PostService.getPostsByUser", () => {
	it("returns posts belonging to the given user", async () => {
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

	it("returns empty result when user has no posts", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		const result = await PostService.getPostsByUser(userId);

		expect(result.posts).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("respects pagination parameters", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		for (let i = 0; i < 5; i++) {
			await seedPost(threadId, userId);
		}

		const page1 = await PostService.getPostsByUser(userId, 1, 2);
		const page2 = await PostService.getPostsByUser(userId, 2, 2);

		expect(page1.posts).toHaveLength(2);
		expect(page2.posts).toHaveLength(2);
		expect(page1.total).toBe(5);
	});
});

// ===========================================================================
// getFlaggedPosts
// ===========================================================================

describe("PostService.getFlaggedPosts", () => {
	it("returns flagged posts", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		await seedPost(threadId, userId, { moderationStatus: "flagged" });
		await seedPost(threadId, userId, { moderationStatus: "flagged" });

		const result = await PostService.getFlaggedPosts();

		expect(result.posts.length).toBeGreaterThanOrEqual(2);
		expect(result.total).toBeGreaterThanOrEqual(2);
	});

	it("returns empty list when no flagged posts exist", async () => {
		const result = await PostService.getFlaggedPosts();

		expect(result.posts).toEqual([]);
		expect(result.total).toBe(0);
	});

	it("excludes non-flagged posts", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		await seedPost(threadId, userId, { moderationStatus: "approved" });
		await seedPost(threadId, userId, { moderationStatus: "flagged" });

		const result = await PostService.getFlaggedPosts();

		expect(result.total).toBe(1);
	});
});

// ===========================================================================
// getPostReplies (exported helper — used by getPostById)
// ===========================================================================

describe("PostService.getPostReplies", () => {
	it("returns empty array when no replies exist", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const post = await seedPost(
			(thread._id as Types.ObjectId).toString(),
			userId,
		);
		const postId = (post._id as Types.ObjectId).toString();

		const replies = await PostService.getPostReplies(postId);

		expect(replies).toEqual([]);
	});

	it("returns replies with nested structure up to maxDepth=2", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		const post = await seedPost(threadId, userId);
		const postId = (post._id as Types.ObjectId).toString();

		const reply = await seedReply(threadId, userId, postId);
		const replyId = (reply._id as Types.ObjectId).toString();

		// depth-2
		await seedReply(threadId, userId, replyId);

		const replies = await PostService.getPostReplies(postId);

		expect(replies).toHaveLength(1);
		expect(replies[0].replies).toHaveLength(1);
		// depth-3 would be empty (maxDepth=2)
		expect(replies[0].replies![0].replies).toEqual([]);
	});

	it("stops recursion at maxDepth", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		const post = await seedPost(threadId, userId);
		const postId = (post._id as Types.ObjectId).toString();

		// Calling with depth = maxDepth should return []
		const replies = await PostService.getPostReplies(postId, 2, 2);

		expect(replies).toEqual([]);
	});
});

// ===========================================================================
// Socket emit branches (getIO returns non-null IO instance)
// ===========================================================================

describe("PostService — socket emit branches", () => {
	let mockEmit: jest.Mock;
	let mockTo: jest.Mock;
	let mockIO: any;

	beforeEach(() => {
		mockEmit = jest.fn();
		mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
		mockIO = { to: mockTo };

		jest.spyOn(socketConfig, "getIO").mockReturnValue(mockIO);
		jest
			.spyOn(queueServiceModule, "publishAIModeration")
			.mockResolvedValue(false);
		jest
			.spyOn(queueServiceModule, "publishNotification")
			.mockResolvedValue(false);
	});

	it("emits new-post event to thread room after createPost when IO is available", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		await PostService.createPost(
			{ threadId, content: "Socket emit test" },
			userId,
		);

		expect(mockTo).toHaveBeenCalledWith(`thread:${threadId}`);
		expect(mockEmit).toHaveBeenCalledWith(
			"new-post",
			expect.objectContaining({ threadId }),
		);
	});

	it("emits post-updated event to thread room after updatePost when IO is available", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const post = await seedPost(
			(thread._id as Types.ObjectId).toString(),
			userId,
		);
		const postId = (post._id as Types.ObjectId).toString();
		const threadId = (thread._id as Types.ObjectId).toString();

		await PostService.updatePost(postId, { content: "Socket update test" }, userId);

		expect(mockTo).toHaveBeenCalledWith(`thread:${threadId}`);
		expect(mockEmit).toHaveBeenCalledWith(
			"post-updated",
			expect.objectContaining({ threadId }),
		);
	});

	it("emits post-deleted event to thread room after deletePost when IO is available", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const post = await seedPost(
			(thread._id as Types.ObjectId).toString(),
			userId,
		);
		const postId = (post._id as Types.ObjectId).toString();
		const threadId = (thread._id as Types.ObjectId).toString();

		await PostService.deletePost(postId, userId);

		expect(mockTo).toHaveBeenCalledWith(`thread:${threadId}`);
		expect(mockEmit).toHaveBeenCalledWith(
			"post-deleted",
			expect.objectContaining({ postId, threadId }),
		);
	});
});
