/**
 * Integration tests for admin queue endpoints:
 *   GET  /api/v1/admin/queue/health
 *   GET  /api/v1/admin/queue/failed-jobs
 *   POST /api/v1/admin/queue/failed-jobs/:id/replay
 */

import request from "supertest";
import { Types } from "mongoose";
import app from "../../../app";
import { FailedQueueJob } from "../../failed-queue-job/failed-queue-job.model";
import {
	createTestUser,
	createTestAdmin,
	generateTestToken,
} from "../../../__tests__/utils/testHelpers";

// ---------------------------------------------------------------------------
// Mock RabbitMQ so no real connection is attempted
// ---------------------------------------------------------------------------

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
	queueService: {
		publishToQueue: jest.fn().mockResolvedValue(true),
	},
	publishAIModeration: jest.fn().mockResolvedValue(true),
	publishNotification: jest.fn().mockResolvedValue(true),
	publishAISummary: jest.fn().mockResolvedValue(true),
	publishWebhook: jest.fn().mockResolvedValue(true),
	publishEmail: jest.fn().mockResolvedValue(true),
}));

// Also mock socket so no IO errors
jest.mock("../../../config/socket", () => ({
	getIO: jest.fn().mockReturnValue(null),
	initSocket: jest.fn(),
}));

afterEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// Helper — create a failed job document directly
// ---------------------------------------------------------------------------

const seedFailedJob = async (overrides: Record<string, unknown> = {}) => {
	return FailedQueueJob.create({
		queue: "ai-moderation",
		payload: { postId: new Types.ObjectId().toString(), content: "test" },
		retryCount: 3,
		lastError: "Processing error",
		failedAt: new Date(),
		status: "failed",
		...overrides,
	});
};

// ===========================================================================
// GET /api/v1/admin/queue/health
// ===========================================================================

describe("GET /api/v1/admin/queue/health", () => {
	it("returns 401 when no auth token provided", async () => {
		const res = await request(app).get("/api/v1/admin/queue/health");
		expect(res.status).toBe(401);
	});

	it("returns 403 when Member role", async () => {
		const user = await createTestUser({ role: "Member" });
		const token = generateTestToken(user._id!, "Member");

		const res = await request(app)
			.get("/api/v1/admin/queue/health")
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(403);
	});

	it("returns 200 with correct shape for Admin", async () => {
		const admin = await createTestAdmin();
		const token = generateTestToken(admin._id!, "Admin");

		const res = await request(app)
			.get("/api/v1/admin/queue/health")
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data).toHaveProperty("pendingModeration");
		expect(res.body.data).toHaveProperty("failedJobs");
		expect(typeof res.body.data.pendingModeration).toBe("number");
		expect(typeof res.body.data.failedJobs).toBe("number");
	});

	it("returns 200 with correct shape for Moderator", async () => {
		const mod = await createTestUser({ role: "Moderator" });
		const token = generateTestToken(mod._id!, "Moderator");

		const res = await request(app)
			.get("/api/v1/admin/queue/health")
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data).toHaveProperty("failedJobs");
	});

	it("reflects seeded failed jobs in failedJobs count", async () => {
		await seedFailedJob();
		await seedFailedJob({ queue: "email" });

		const admin = await createTestAdmin();
		const token = generateTestToken(admin._id!, "Admin");

		const res = await request(app)
			.get("/api/v1/admin/queue/health")
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(200);
		expect(res.body.data.failedJobs).toBe(2);
	});
});

// ===========================================================================
// GET /api/v1/admin/queue/failed-jobs
// ===========================================================================

describe("GET /api/v1/admin/queue/failed-jobs", () => {
	it("returns 401 when no auth token provided", async () => {
		const res = await request(app).get("/api/v1/admin/queue/failed-jobs");
		expect(res.status).toBe(401);
	});

	it("returns 403 when Member role", async () => {
		const user = await createTestUser({ role: "Member" });
		const token = generateTestToken(user._id!, "Member");

		const res = await request(app)
			.get("/api/v1/admin/queue/failed-jobs")
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(403);
	});

	it("returns 403 when Moderator role (Admin only endpoint)", async () => {
		const mod = await createTestUser({ role: "Moderator" });
		const token = generateTestToken(mod._id!, "Moderator");

		const res = await request(app)
			.get("/api/v1/admin/queue/failed-jobs")
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(403);
	});

	it("returns 200 with paginated list for Admin", async () => {
		await seedFailedJob();
		await seedFailedJob({ queue: "email" });

		const admin = await createTestAdmin();
		const token = generateTestToken(admin._id!, "Admin");

		const res = await request(app)
			.get("/api/v1/admin/queue/failed-jobs")
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(Array.isArray(res.body.data)).toBe(true);
		expect(res.body.data).toHaveLength(2);
		expect(res.body.meta).toBeDefined();
		expect(res.body.meta.total).toBe(2);
	});

	it("returns empty array when no failed jobs exist", async () => {
		const admin = await createTestAdmin();
		const token = generateTestToken(admin._id!, "Admin");

		const res = await request(app)
			.get("/api/v1/admin/queue/failed-jobs")
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(200);
		expect(res.body.data).toHaveLength(0);
		expect(res.body.meta.total).toBe(0);
	});

	it("respects page and limit query params", async () => {
		for (let i = 0; i < 5; i++) {
			await seedFailedJob();
		}

		const admin = await createTestAdmin();
		const token = generateTestToken(admin._id!, "Admin");

		const res = await request(app)
			.get("/api/v1/admin/queue/failed-jobs?page=1&limit=2")
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(200);
		expect(res.body.data).toHaveLength(2);
		expect(res.body.meta.total).toBe(5);
		expect(res.body.meta.totalPage).toBe(3);
	});

	it("excludes replayed jobs from results", async () => {
		await seedFailedJob();
		await seedFailedJob({ status: "replayed", replayedAt: new Date() });

		const admin = await createTestAdmin();
		const token = generateTestToken(admin._id!, "Admin");

		const res = await request(app)
			.get("/api/v1/admin/queue/failed-jobs")
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(200);
		expect(res.body.data).toHaveLength(1);
	});
});

// ===========================================================================
// POST /api/v1/admin/queue/failed-jobs/:id/replay
// ===========================================================================

describe("POST /api/v1/admin/queue/failed-jobs/:id/replay", () => {
	it("returns 401 when no auth token provided", async () => {
		const fakeId = new Types.ObjectId().toString();
		const res = await request(app).post(
			`/api/v1/admin/queue/failed-jobs/${fakeId}/replay`,
		);
		expect(res.status).toBe(401);
	});

	it("returns 403 when Moderator role (Admin only endpoint)", async () => {
		const mod = await createTestUser({ role: "Moderator" });
		const token = generateTestToken(mod._id!, "Moderator");
		const fakeId = new Types.ObjectId().toString();

		const res = await request(app)
			.post(`/api/v1/admin/queue/failed-jobs/${fakeId}/replay`)
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(403);
	});

	it("returns 403 when Member role", async () => {
		const user = await createTestUser({ role: "Member" });
		const token = generateTestToken(user._id!, "Member");
		const fakeId = new Types.ObjectId().toString();

		const res = await request(app)
			.post(`/api/v1/admin/queue/failed-jobs/${fakeId}/replay`)
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(403);
	});

	it("returns 404 for non-existent job id", async () => {
		const admin = await createTestAdmin();
		const token = generateTestToken(admin._id!, "Admin");
		const nonExistentId = new Types.ObjectId().toString();

		const res = await request(app)
			.post(`/api/v1/admin/queue/failed-jobs/${nonExistentId}/replay`)
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(404);
		expect(res.body.success).toBe(false);
	});

	it("returns 400 for an already-replayed job", async () => {
		const replayedJob = await seedFailedJob({
			status: "replayed",
			replayedAt: new Date(),
		});

		const admin = await createTestAdmin();
		const token = generateTestToken(admin._id!, "Admin");

		const res = await request(app)
			.post(`/api/v1/admin/queue/failed-jobs/${replayedJob._id}/replay`)
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(400);
		expect(res.body.success).toBe(false);
	});

	it("returns 200 and marks job as replayed for Admin", async () => {
		const job = await seedFailedJob();

		const admin = await createTestAdmin();
		const token = generateTestToken(admin._id!, "Admin");

		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { queueService } = require("../../../services/queue.service");

		const res = await request(app)
			.post(`/api/v1/admin/queue/failed-jobs/${job._id}/replay`)
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data).toBeDefined();
		expect(res.body.data.status).toBe("replayed");
		expect(res.body.data.replayedAt).toBeDefined();

		// Ensure the queue was called to re-publish
		expect(queueService.publishToQueue).toHaveBeenCalledWith(
			job.queue,
			expect.anything(),
		);
	});

	it("persists replayed status — job no longer appears in failed-jobs list after replay", async () => {
		const job = await seedFailedJob();

		const admin = await createTestAdmin();
		const token = generateTestToken(admin._id!, "Admin");

		// Replay it
		await request(app)
			.post(`/api/v1/admin/queue/failed-jobs/${job._id}/replay`)
			.set("Authorization", `Bearer ${token}`);

		// Now list should be empty
		const listRes = await request(app)
			.get("/api/v1/admin/queue/failed-jobs")
			.set("Authorization", `Bearer ${token}`);

		expect(listRes.status).toBe(200);
		expect(listRes.body.data).toHaveLength(0);
	});
});
