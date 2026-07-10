/**
 * Integration-style unit tests for FailedQueueJobService
 * Uses real MongoMemoryServer (via setup.ts) — no model mocking needed.
 */

import { Types } from "mongoose";
import { FailedQueueJob } from "../failed-queue-job.model";
import { FailedQueueJobService } from "../failed-queue-job.service";

afterEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeJobData = (overrides: Partial<{
	queue: string;
	payload: Record<string, unknown>;
	retryCount: number;
	lastError: string;
}> = {}) => ({
	queue: "ai-moderation",
	payload: { postId: new Types.ObjectId().toString(), content: "hello" },
	retryCount: 3,
	lastError: "Processing failed",
	...overrides,
});

// ---------------------------------------------------------------------------
// save()
// ---------------------------------------------------------------------------

describe("FailedQueueJobService.save", () => {
	it("creates a document with correct fields and default status='failed'", async () => {
		const data = makeJobData();
		const job = await FailedQueueJobService.save(data);

		expect(job._id).toBeDefined();
		expect(job.queue).toBe(data.queue);
		expect(job.payload).toMatchObject(data.payload);
		expect(job.retryCount).toBe(data.retryCount);
		expect(job.lastError).toBe(data.lastError);
		expect(job.status).toBe("failed");
		expect(job.failedAt).toBeInstanceOf(Date);
		expect(job.replayedAt).toBeUndefined();
	});

	it("persists the document so it can be found in the DB", async () => {
		const data = makeJobData({ queue: "notifications" });
		const job = await FailedQueueJobService.save(data);

		const found = await FailedQueueJob.findById(job._id);
		expect(found).not.toBeNull();
		expect(found!.queue).toBe("notifications");
	});

	it("sets failedAt to a recent date (within 5 seconds)", async () => {
		const before = new Date();
		const job = await FailedQueueJobService.save(makeJobData());
		const after = new Date();

		expect(job.failedAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 100);
		expect(job.failedAt.getTime()).toBeLessThanOrEqual(after.getTime() + 100);
	});

	it("stores complex payload objects correctly", async () => {
		const payload = {
			postId: "abc123",
			content: "test content",
			authorId: "user456",
			nested: { key: "value" },
		};
		const job = await FailedQueueJobService.save(makeJobData({ payload }));

		expect(job.payload.postId).toBe("abc123");
		expect(job.payload.content).toBe("test content");
	});
});

// ---------------------------------------------------------------------------
// countPending()
// ---------------------------------------------------------------------------

describe("FailedQueueJobService.countPending", () => {
	it("returns 0 when no failed jobs exist", async () => {
		const count = await FailedQueueJobService.countPending();
		expect(count).toBe(0);
	});

	it("returns correct count when failed jobs exist", async () => {
		await FailedQueueJobService.save(makeJobData());
		await FailedQueueJobService.save(makeJobData({ queue: "email" }));

		const count = await FailedQueueJobService.countPending();
		expect(count).toBe(2);
	});

	it("ignores jobs with status='replayed'", async () => {
		const job1 = await FailedQueueJobService.save(makeJobData());
		await FailedQueueJobService.save(makeJobData({ queue: "email" }));

		// Mark one as replayed directly
		await FailedQueueJob.findByIdAndUpdate(job1._id, {
			status: "replayed",
			replayedAt: new Date(),
		});

		const count = await FailedQueueJobService.countPending();
		expect(count).toBe(1);
	});

	it("returns 0 when all jobs have been replayed", async () => {
		const job = await FailedQueueJobService.save(makeJobData());
		await FailedQueueJob.findByIdAndUpdate(job._id, {
			status: "replayed",
			replayedAt: new Date(),
		});

		const count = await FailedQueueJobService.countPending();
		expect(count).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// getFailedJobs()
// ---------------------------------------------------------------------------

describe("FailedQueueJobService.getFailedJobs", () => {
	it("returns empty result when no failed jobs exist", async () => {
		const result = await FailedQueueJobService.getFailedJobs(1, 10);

		expect(result.jobs).toHaveLength(0);
		expect(result.total).toBe(0);
		expect(result.totalPage).toBe(0);
	});

	it("returns paginated results sorted by failedAt descending", async () => {
		// Insert with slight delays to get distinct failedAt times
		const job1 = await FailedQueueJob.create({
			queue: "ai-moderation",
			payload: { postId: "1" },
			retryCount: 1,
			lastError: "err1",
			failedAt: new Date("2024-01-01T10:00:00Z"),
		});
		const job2 = await FailedQueueJob.create({
			queue: "email",
			payload: { postId: "2" },
			retryCount: 2,
			lastError: "err2",
			failedAt: new Date("2024-01-01T11:00:00Z"),
		});

		const result = await FailedQueueJobService.getFailedJobs(1, 10);

		expect(result.jobs).toHaveLength(2);
		expect(result.total).toBe(2);
		expect(result.totalPage).toBe(1);

		// Most recent first
		expect(result.jobs[0]._id!.toString()).toBe(job2._id.toString());
		expect(result.jobs[1]._id!.toString()).toBe(job1._id.toString());
	});

	it("paginates correctly — page 1 returns first N, page 2 returns next N", async () => {
		for (let i = 0; i < 5; i++) {
			await FailedQueueJob.create({
				queue: "ai-moderation",
				payload: { index: i },
				retryCount: i,
				lastError: `error ${i}`,
				failedAt: new Date(Date.now() + i * 1000),
			});
		}

		const page1 = await FailedQueueJobService.getFailedJobs(1, 2);
		const page2 = await FailedQueueJobService.getFailedJobs(2, 2);
		const page3 = await FailedQueueJobService.getFailedJobs(3, 2);

		expect(page1.jobs).toHaveLength(2);
		expect(page2.jobs).toHaveLength(2);
		expect(page3.jobs).toHaveLength(1);
		expect(page1.total).toBe(5);
		expect(page1.totalPage).toBe(3);
	});

	it("calculates totalPage correctly with exact multiple", async () => {
		for (let i = 0; i < 4; i++) {
			await FailedQueueJob.create({
				queue: "email",
				payload: { i },
				retryCount: 0,
				lastError: "err",
				failedAt: new Date(),
			});
		}

		const result = await FailedQueueJobService.getFailedJobs(1, 2);
		expect(result.totalPage).toBe(2);
	});

	it("only returns jobs with status='failed' (excludes replayed)", async () => {
		const failedJob = await FailedQueueJobService.save(makeJobData());
		await FailedQueueJob.create({
			queue: "email",
			payload: {},
			retryCount: 3,
			lastError: "err",
			failedAt: new Date(),
			status: "replayed",
			replayedAt: new Date(),
		});

		const result = await FailedQueueJobService.getFailedJobs(1, 10);

		expect(result.jobs).toHaveLength(1);
		expect(result.jobs[0]._id!.toString()).toBe(failedJob._id!.toString());
		expect(result.total).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// markReplayed()
// ---------------------------------------------------------------------------

describe("FailedQueueJobService.markReplayed", () => {
	it("updates status to 'replayed' and sets replayedAt", async () => {
		const job = await FailedQueueJobService.save(makeJobData());

		const updated = await FailedQueueJobService.markReplayed(
			job._id!.toString(),
		);

		expect(updated).not.toBeNull();
		expect(updated!.status).toBe("replayed");
		expect(updated!.replayedAt).toBeInstanceOf(Date);
	});

	it("returns the updated document (new: true)", async () => {
		const job = await FailedQueueJobService.save(makeJobData());

		const updated = await FailedQueueJobService.markReplayed(
			job._id!.toString(),
		);

		expect(updated!._id!.toString()).toBe(job._id!.toString());
		expect(updated!.queue).toBe(job.queue);
	});

	it("persists the replayed status so countPending excludes it", async () => {
		const job = await FailedQueueJobService.save(makeJobData());
		expect(await FailedQueueJobService.countPending()).toBe(1);

		await FailedQueueJobService.markReplayed(job._id!.toString());

		expect(await FailedQueueJobService.countPending()).toBe(0);
	});

	it("returns null for a non-existent id", async () => {
		const fakeId = new Types.ObjectId().toString();
		const result = await FailedQueueJobService.markReplayed(fakeId);
		expect(result).toBeNull();
	});
});
