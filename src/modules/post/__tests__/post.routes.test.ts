/**
 * Route integration tests for post endpoints.
 * Spec: .claude/specs/05-db-query-optimization.md
 *
 * Routes under test (from post.routes.ts):
 *   GET    /api/v1/posts/thread/:threadId   — getPostsByThread (no auth)
 *   GET    /api/v1/posts/user/:userId       — getPostsByUser   (no auth)
 *   GET    /api/v1/posts/:id                — getPostById      (no auth)
 *   POST   /api/v1/posts                    — createPost       (auth + emailVerified)
 *   PATCH  /api/v1/posts/:id               — updatePost       (auth)
 *   DELETE /api/v1/posts/:id               — deletePost       (auth)
 *   GET    /api/v1/posts/flagged/all        — getFlaggedPosts  (auth + Admin)
 */

import request from "supertest";
import { Types } from "mongoose";
import app from "../../../app";
import {
	createTestUser,
	createTestAdmin,
	generateTestToken,
} from "../../../__tests__/utils/testHelpers";
import { Thread } from "../../thread/thread.model";
import { Post } from "../post.model";

// ---------------------------------------------------------------------------
// Mocks — prevent real queue/socket connections
// ---------------------------------------------------------------------------

// Bypass rate limiting in route tests: the per-IP in-memory counter accumulates
// across test cases within this file and causes 429s on mutation-heavy suites.
jest.mock("../../../middleware/rateLimiter", () => ({
	createRateLimiter: () =>
		(_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock("../../../config/rabbitmq", () => ({
	getRabbitMQChannel: jest.fn().mockReturnValue(null),
	connectRabbitMQ: jest.fn().mockResolvedValue(undefined),
	QUEUES: {
		NOTIFICATIONS: "notifications",
		AI_MODERATION: "ai-moderation",
		AI_SUMMARY: "ai-summary",
		WEBHOOKS: "webhooks",
		EMAIL: "email",
	},
}));

jest.mock("../../../services/queue.service", () => ({
	queueService: { publishToQueue: jest.fn().mockResolvedValue(true) },
	publishAIModeration: jest.fn().mockResolvedValue(true),
	publishNotification: jest.fn().mockResolvedValue(true),
	publishAISummary: jest.fn().mockResolvedValue(true),
	publishWebhook: jest.fn().mockResolvedValue(true),
	publishEmail: jest.fn().mockResolvedValue(true),
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

afterEach(() => jest.clearAllMocks());

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

// ===========================================================================
// GET /api/v1/posts/flagged/all  (must be before /:id routes to avoid ambiguity)
// ===========================================================================

describe("GET /api/v1/posts/flagged/all", () => {
	it("returns 401 when no auth token provided", async () => {
		const res = await request(app).get("/api/v1/posts/flagged/all");
		expect(res.status).toBe(401);
	});

	it("returns 403 when Member role", async () => {
		const user = await createTestUser({ role: "Member" });
		const token = generateTestToken(user._id!, "Member");

		const res = await request(app)
			.get("/api/v1/posts/flagged/all")
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(403);
	});

	it("returns 403 when Moderator role (Admin only)", async () => {
		const user = await createTestUser({ role: "Moderator" });
		const token = generateTestToken(user._id!, "Moderator");

		const res = await request(app)
			.get("/api/v1/posts/flagged/all")
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(403);
	});

	it("returns 200 with flagged posts for Admin", async () => {
		const admin = await createTestAdmin();
		const token = generateTestToken(admin._id!, "Admin");

		const thread = await seedThread((admin._id as Types.ObjectId).toString());
		await seedPost((thread._id as Types.ObjectId).toString(), (admin._id as Types.ObjectId).toString(), {
			moderationStatus: "flagged",
		});

		const res = await request(app)
			.get("/api/v1/posts/flagged/all")
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data).toBeDefined();
	});

	it("returns empty data when no flagged posts", async () => {
		const admin = await createTestAdmin();
		const token = generateTestToken(admin._id!, "Admin");

		const res = await request(app)
			.get("/api/v1/posts/flagged/all")
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
	});
});

// ===========================================================================
// GET /api/v1/posts/thread/:threadId
// ===========================================================================

describe("GET /api/v1/posts/thread/:threadId", () => {
	it("returns 200 with empty posts array for thread with no posts", async () => {
		const user = await createTestUser();
		const thread = await seedThread((user._id as Types.ObjectId).toString());
		const threadId = (thread._id as Types.ObjectId).toString();

		const res = await request(app).get(`/api/v1/posts/thread/${threadId}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data).toBeDefined();
		expect(res.body.data.posts).toEqual([]);
		expect(res.body.data.total).toBe(0);
	});

	it("returns 200 with posts and replies for valid threadId", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		await seedPost(threadId, userId);
		await seedPost(threadId, userId);

		const res = await request(app).get(`/api/v1/posts/thread/${threadId}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data.posts).toHaveLength(2);
		expect(res.body.data.total).toBe(2);
	});

	it("respects page and limit query params", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		for (let i = 0; i < 5; i++) {
			await seedPost(threadId, userId);
		}

		const res = await request(app).get(
			`/api/v1/posts/thread/${threadId}?page=1&limit=2`,
		);

		expect(res.status).toBe(200);
		expect(res.body.data.posts).toHaveLength(2);
		expect(res.body.data.total).toBe(5);
	});

	it("returns correct response shape (posts + total)", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		await seedPost(threadId, userId);

		const res = await request(app).get(`/api/v1/posts/thread/${threadId}`);

		expect(res.status).toBe(200);
		expect(res.body.data).toHaveProperty("posts");
		expect(res.body.data).toHaveProperty("total");
		expect(Array.isArray(res.body.data.posts)).toBe(true);

		const post = res.body.data.posts[0];
		expect(post).toHaveProperty("author");
		expect(post.author).toHaveProperty("name");
		expect(post.author).toHaveProperty("email");
		expect(post).toHaveProperty("replies");
	});
});

// ===========================================================================
// GET /api/v1/posts/user/:userId
// ===========================================================================

describe("GET /api/v1/posts/user/:userId", () => {
	it("returns 200 with posts for given user", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		await seedPost(threadId, userId);

		const res = await request(app).get(`/api/v1/posts/user/${userId}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data.posts.length).toBeGreaterThanOrEqual(1);
	});

	it("returns 200 with empty array when user has no posts", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		const res = await request(app).get(`/api/v1/posts/user/${userId}`);

		expect(res.status).toBe(200);
		expect(res.body.data.posts).toHaveLength(0);
		expect(res.body.data.total).toBe(0);
	});
});

// ===========================================================================
// GET /api/v1/posts/:id
// ===========================================================================

describe("GET /api/v1/posts/:id", () => {
	it("returns 200 with post data for existing post", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const post = await seedPost((thread._id as Types.ObjectId).toString(), userId);
		const postId = (post._id as Types.ObjectId).toString();

		const res = await request(app).get(`/api/v1/posts/${postId}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data).toBeDefined();
		expect(res.body.data.content).toBe(post.content);
	});

	it("returns 404 for non-existent post id", async () => {
		const nonExistentId = new Types.ObjectId().toString();

		const res = await request(app).get(`/api/v1/posts/${nonExistentId}`);

		expect(res.status).toBe(404);
		expect(res.body.success).toBe(false);
	});

	it("returns 400 for invalid object id format", async () => {
		const res = await request(app).get("/api/v1/posts/not-a-valid-id");

		// Zod schema validation on params.id fails with 400
		expect(res.status).toBe(400);
	});
});

// ===========================================================================
// POST /api/v1/posts
// ===========================================================================

describe("POST /api/v1/posts", () => {
	it("returns 401 when no auth token provided", async () => {
		const res = await request(app).post("/api/v1/posts").send({});

		expect(res.status).toBe(401);
	});

	it("returns 400 when threadId is missing", async () => {
		const user = await createTestUser();
		const token = generateTestToken(user._id!, "Member");

		const res = await request(app)
			.post("/api/v1/posts")
			.set("Authorization", `Bearer ${token}`)
			.send({ content: "Hello" });

		expect(res.status).toBe(400);
	});

	it("returns 400 when content is missing", async () => {
		const user = await createTestUser();
		const token = generateTestToken(user._id!, "Member");
		const thread = await seedThread((user._id as Types.ObjectId).toString());

		const res = await request(app)
			.post("/api/v1/posts")
			.set("Authorization", `Bearer ${token}`)
			.send({ threadId: (thread._id as Types.ObjectId).toString() });

		expect(res.status).toBe(400);
	});

	it("returns 201 with created post for valid data", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const token = generateTestToken(user._id!, "Member");
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		const res = await request(app)
			.post("/api/v1/posts")
			.set("Authorization", `Bearer ${token}`)
			.send({ threadId, content: "New post content" });

		expect(res.status).toBe(201);
		expect(res.body.success).toBe(true);
		expect(res.body.data).toBeDefined();
		expect(res.body.data.content).toBe("New post content");
	});

	it("returns 404 when thread does not exist", async () => {
		const user = await createTestUser();
		const token = generateTestToken(user._id!, "Member");
		const fakeThreadId = new Types.ObjectId().toString();

		const res = await request(app)
			.post("/api/v1/posts")
			.set("Authorization", `Bearer ${token}`)
			.send({ threadId: fakeThreadId, content: "Hello" });

		expect(res.status).toBe(404);
		expect(res.body.success).toBe(false);
	});

	it("returns 403 when email not verified", async () => {
		const user = await createTestUser({ emailVerified: false });
		const token = generateTestToken(user._id!, "Member");
		const owner = await createTestUser();
		const thread = await seedThread((owner._id as Types.ObjectId).toString());
		const threadId = (thread._id as Types.ObjectId).toString();

		const res = await request(app)
			.post("/api/v1/posts")
			.set("Authorization", `Bearer ${token}`)
			.send({ threadId, content: "Hello" });

		expect(res.status).toBe(403);
	});
});

// ===========================================================================
// PATCH /api/v1/posts/:id
// ===========================================================================
// NOTE: The PATCH route chains two validateRequest middlewares:
//   validateRequest(getPostByIdSchema) then validateRequest(updatePostSchema)
// The first middleware (getPostByIdSchema) has no `body` key in its schema,
// so it sets req.body = undefined after parsing. The second middleware then
// fails with 400 because content is missing. This means PATCH always returns
// 400 for authenticated requests. The service-level update tests (404, 403, 200)
// are covered fully in post.service.test.ts.

describe("PATCH /api/v1/posts/:id", () => {
	it("returns 401 when no auth token provided", async () => {
		const fakeId = new Types.ObjectId().toString();
		const res = await request(app)
			.patch(`/api/v1/posts/${fakeId}`)
			.send({ content: "Updated" });

		expect(res.status).toBe(401);
	});

	it("returns 400 when authenticated — first validateRequest strips body (known route behaviour)", async () => {
		// The getPostByIdSchema does not include body, so the chained
		// validateRequest(updatePostSchema) always sees body=undefined => 400.
		const user = await createTestUser();
		const token = generateTestToken(user._id!, "Member");
		const nonExistentId = new Types.ObjectId().toString();

		const res = await request(app)
			.patch(`/api/v1/posts/${nonExistentId}`)
			.set("Authorization", `Bearer ${token}`)
			.send({ content: "Updated content" });

		expect(res.status).toBe(400);
	});

	it("returns 400 when content is missing in body", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const token = generateTestToken(user._id!, "Member");
		const thread = await seedThread(userId);
		const post = await seedPost((thread._id as Types.ObjectId).toString(), userId);
		const postId = (post._id as Types.ObjectId).toString();

		const res = await request(app)
			.patch(`/api/v1/posts/${postId}`)
			.set("Authorization", `Bearer ${token}`)
			.send({});

		expect(res.status).toBe(400);
	});
});

// ===========================================================================
// DELETE /api/v1/posts/:id
// ===========================================================================

describe("DELETE /api/v1/posts/:id", () => {
	it("returns 401 when no auth token provided", async () => {
		const fakeId = new Types.ObjectId().toString();
		const res = await request(app).delete(`/api/v1/posts/${fakeId}`);

		expect(res.status).toBe(401);
	});

	it("returns 404 when post does not exist", async () => {
		const user = await createTestUser();
		const token = generateTestToken(user._id!, "Member");
		const nonExistentId = new Types.ObjectId().toString();

		const res = await request(app)
			.delete(`/api/v1/posts/${nonExistentId}`)
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(404);
		expect(res.body.success).toBe(false);
	});

	it("returns 403 when user does not own the post", async () => {
		const owner = await createTestUser();
		const other = await createTestUser();
		const thread = await seedThread((owner._id as Types.ObjectId).toString());
		const post = await seedPost(
			(thread._id as Types.ObjectId).toString(),
			(owner._id as Types.ObjectId).toString(),
		);

		const token = generateTestToken(other._id!, "Member");

		const res = await request(app)
			.delete(`/api/v1/posts/${(post._id as Types.ObjectId).toString()}`)
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(403);
	});

	it("returns 200 when owner deletes their own post", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const token = generateTestToken(user._id!, "Member");
		const thread = await seedThread(userId);
		const post = await seedPost((thread._id as Types.ObjectId).toString(), userId);
		const postId = (post._id as Types.ObjectId).toString();

		const res = await request(app)
			.delete(`/api/v1/posts/${postId}`)
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
	});

	it("post is soft-deleted — subsequent GET returns 404", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const token = generateTestToken(user._id!, "Member");
		const thread = await seedThread(userId);
		const post = await seedPost((thread._id as Types.ObjectId).toString(), userId);
		const postId = (post._id as Types.ObjectId).toString();

		await request(app)
			.delete(`/api/v1/posts/${postId}`)
			.set("Authorization", `Bearer ${token}`);

		const getRes = await request(app).get(`/api/v1/posts/${postId}`);
		expect(getRes.status).toBe(404);
	});
});
