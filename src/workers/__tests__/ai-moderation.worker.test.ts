/**
 * Unit tests for ai-moderation.worker.ts — Stage A (local filter) and Stage B (hash dedup)
 * Spec: .claude/specs/06-ai-cost-filter.md
 */

import { Types } from "mongoose";
import { createTestUser } from "../../__tests__/utils/testHelpers";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that reference them
// ---------------------------------------------------------------------------

const mockConsumeQueue = jest.fn();

// Mock rabbitmq config so queue.service.ts doesn't try to call getRabbitMQChannel()
jest.mock("../../config/rabbitmq", () => ({
	QUEUES: { AI_MODERATION: "ai-moderation" },
	getRabbitMQChannel: jest.fn().mockReturnValue(null),
	connectRabbitMQ: jest.fn().mockResolvedValue(undefined),
}));

// Mock queue.service directly since the worker imports queueService from there
jest.mock("../../services/queue.service", () => ({
	queueService: { consumeQueue: mockConsumeQueue },
}));

const mockModerateContent = jest.fn();
jest.mock("../../services/ai.service", () => ({
	AIService: {
		moderateContent: mockModerateContent,
	},
}));

const mockGetJSON = jest.fn();
const mockSetJSON = jest.fn();
jest.mock("../../config/redis", () => ({
	cacheService: {
		getJSON: mockGetJSON,
		setJSON: mockSetJSON,
	},
}));

const mockPostFindById = jest.fn();
const mockPostSave = jest.fn();
jest.mock("../../modules/post/post.model", () => ({
	Post: {
		findById: mockPostFindById,
	},
}));

const mockReportCreate = jest.fn();
jest.mock("../../modules/admin/admin.model", () => ({
	Report: {
		create: mockReportCreate,
	},
}));

const mockThreadFindById = jest.fn();
jest.mock("../../modules/thread/thread.model", () => ({
	Thread: {
		findById: mockThreadFindById,
	},
}));

const mockCreateAIModerationRejectedNotification = jest.fn();
const mockCreateAIModerationFlaggedNotification = jest.fn();
jest.mock("../../modules/notification/notification.service", () => ({
	NotificationService: {
		createAIModerationRejectedNotification: mockCreateAIModerationRejectedNotification,
		createAIModerationFlaggedNotification: mockCreateAIModerationFlaggedNotification,
	},
}));

const mockCheckContentLocally = jest.fn();
const mockHashContent = jest.fn();
jest.mock("../../utils/content-filter", () => ({
	checkContentLocally: mockCheckContentLocally,
	hashContent: mockHashContent,
}));

// ---------------------------------------------------------------------------
// Import the worker AFTER all mocks are set up
// ---------------------------------------------------------------------------

import { startAIModerationWorker } from "../ai-moderation.worker";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Starts the worker, captures the message handler passed to consumeQueue,
 * and returns it so tests can invoke it directly.
 */
const getWorkerHandler = async (): Promise<
	(msg: { postId: string; content: string; authorId: string }) => Promise<void>
> => {
	mockConsumeQueue.mockImplementationOnce(
		async (_queue: string, handler: Function) => {
			// Store handler for retrieval — do NOT call it yet
			(getWorkerHandler as any)._handler = handler;
		},
	);
	await startAIModerationWorker();
	return (getWorkerHandler as any)._handler;
};

/**
 * Creates a minimal mock Post document (simulates a Mongoose document).
 */
const makeMockPost = (overrides: Record<string, unknown> = {}) => {
	const post: Record<string, unknown> = {
		_id: new Types.ObjectId(),
		threadId: new Types.ObjectId(),
		content: "Some test content",
		moderationStatus: "pending",
		status: "active",
		aiScore: null,
		aiReasoning: null,
		aiRecommendation: null,
		save: mockPostSave,
		...overrides,
	};
	return post;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AI Moderation Worker — Stage A (local filter)", () => {
	let handler: Awaited<ReturnType<typeof getWorkerHandler>>;
	let testUser: Awaited<ReturnType<typeof createTestUser>>;

	beforeEach(async () => {
		jest.clearAllMocks();
		mockPostSave.mockResolvedValue(undefined);
		mockReportCreate.mockResolvedValue({});
		mockCreateAIModerationRejectedNotification.mockResolvedValue(undefined);
		mockCreateAIModerationFlaggedNotification.mockResolvedValue(undefined);
		testUser = await createTestUser();
		handler = await getWorkerHandler();
	});

	afterEach(() => jest.clearAllMocks());

	it("auto-approves post without calling AIService when localResult is 'approve'", async () => {
		mockCheckContentLocally.mockReturnValue("approve");
		const post = makeMockPost();
		mockPostFindById.mockResolvedValue(post);

		await handler({
			postId: new Types.ObjectId().toString(),
			content: "hi",
			authorId: testUser._id!.toString(),
		});

		expect(post.moderationStatus).toBe("approved");
		expect(post.aiScore).toEqual({ spam: 0.05, toxicity: 0.05, inappropriate: 0.05 });
		expect(post.aiReasoning).toBe("Auto-approved: content too short or clearly clean");
		expect(post.aiRecommendation).toBe("approve");
		expect(mockPostSave).toHaveBeenCalledTimes(1);
		expect(mockModerateContent).not.toHaveBeenCalled();
		expect(mockGetJSON).not.toHaveBeenCalled();
	});

	it("does not create a Report or notification when auto-approving", async () => {
		mockCheckContentLocally.mockReturnValue("approve");
		const post = makeMockPost();
		mockPostFindById.mockResolvedValue(post);

		await handler({
			postId: new Types.ObjectId().toString(),
			content: "hi",
			authorId: testUser._id!.toString(),
		});

		expect(mockReportCreate).not.toHaveBeenCalled();
		expect(mockCreateAIModerationRejectedNotification).not.toHaveBeenCalled();
	});

	it("auto-rejects post without calling AIService when localResult is 'reject'", async () => {
		mockCheckContentLocally.mockReturnValue("reject");
		const post = makeMockPost();
		mockPostFindById.mockResolvedValue(post);
		const thread = { _id: new Types.ObjectId(), title: "Test Thread" };
		mockThreadFindById.mockResolvedValue(thread);

		await handler({
			postId: new Types.ObjectId().toString(),
			content: "kill yourself right now today man",
			authorId: testUser._id!.toString(),
		});

		expect(post.moderationStatus).toBe("rejected");
		expect(post.status).toBe("deleted");
		expect(post.aiScore).toEqual({ spam: 0.95, toxicity: 0.95, inappropriate: 0.95 });
		expect(post.aiReasoning).toBe("Auto-rejected: matched local toxic/spam pattern");
		expect(post.aiRecommendation).toBe("reject");
		expect(mockPostSave).toHaveBeenCalledTimes(1);
		expect(mockModerateContent).not.toHaveBeenCalled();
	});

	it("creates a Report when auto-rejecting via local filter", async () => {
		mockCheckContentLocally.mockReturnValue("reject");
		const post = makeMockPost();
		mockPostFindById.mockResolvedValue(post);
		mockThreadFindById.mockResolvedValue({ _id: new Types.ObjectId(), title: "Test Thread" });

		const postId = new Types.ObjectId().toString();
		const authorId = testUser._id!.toString();

		await handler({ postId, content: "kys loser", authorId });

		expect(mockReportCreate).toHaveBeenCalledTimes(1);
		expect(mockReportCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				reportedContentType: "post",
				reportType: "harassment",
				status: "reviewing",
			}),
		);
	});

	it("sends rejection notification when auto-rejecting via local filter", async () => {
		mockCheckContentLocally.mockReturnValue("reject");
		const post = makeMockPost();
		mockPostFindById.mockResolvedValue(post);
		const thread = { _id: new Types.ObjectId(), title: "My Thread" };
		mockThreadFindById.mockResolvedValue(thread);

		const authorId = testUser._id!.toString();
		const postId = new Types.ObjectId().toString();

		await handler({ postId, content: "buy now spam content here", authorId });

		expect(mockCreateAIModerationRejectedNotification).toHaveBeenCalledTimes(1);
		expect(mockCreateAIModerationRejectedNotification).toHaveBeenCalledWith(
			authorId,
			postId,
			expect.any(String),
			thread.title,
			"Auto-rejected: matched local toxic/spam pattern",
		);
	});

	it("skips notification if thread not found during local reject", async () => {
		mockCheckContentLocally.mockReturnValue("reject");
		const post = makeMockPost();
		mockPostFindById.mockResolvedValue(post);
		mockThreadFindById.mockResolvedValue(null);

		await handler({
			postId: new Types.ObjectId().toString(),
			content: "kys everyone here today",
			authorId: testUser._id!.toString(),
		});

		expect(mockCreateAIModerationRejectedNotification).not.toHaveBeenCalled();
		expect(mockReportCreate).toHaveBeenCalledTimes(1);
	});

	it("returns early without crash when post not found during local approve", async () => {
		mockCheckContentLocally.mockReturnValue("approve");
		mockPostFindById.mockResolvedValue(null);

		await expect(
			handler({
				postId: new Types.ObjectId().toString(),
				content: "short",
				authorId: testUser._id!.toString(),
			}),
		).resolves.toBeUndefined();

		expect(mockPostSave).not.toHaveBeenCalled();
	});

	it("returns early without crash when post not found during local reject", async () => {
		mockCheckContentLocally.mockReturnValue("reject");
		mockPostFindById.mockResolvedValue(null);

		await expect(
			handler({
				postId: new Types.ObjectId().toString(),
				content: "kill yourself loser",
				authorId: testUser._id!.toString(),
			}),
		).resolves.toBeUndefined();

		expect(mockPostSave).not.toHaveBeenCalled();
		expect(mockReportCreate).not.toHaveBeenCalled();
	});
});

describe("AI Moderation Worker — Stage B (hash dedup cache)", () => {
	let handler: Awaited<ReturnType<typeof getWorkerHandler>>;
	let testUser: Awaited<ReturnType<typeof createTestUser>>;

	beforeEach(async () => {
		jest.clearAllMocks();
		mockPostSave.mockResolvedValue(undefined);
		mockReportCreate.mockResolvedValue({});
		mockCreateAIModerationRejectedNotification.mockResolvedValue(undefined);
		mockCreateAIModerationFlaggedNotification.mockResolvedValue(undefined);
		// Default: local filter passes to API stage
		mockCheckContentLocally.mockReturnValue("api");
		mockHashContent.mockReturnValue("abc123hash");
		testUser = await createTestUser();
		handler = await getWorkerHandler();
	});

	afterEach(() => jest.clearAllMocks());

	it("uses cached moderation result and does NOT call AIService on cache hit", async () => {
		const cachedResult = {
			isSpam: false,
			isToxic: false,
			isInappropriate: false,
			spamScore: 0.1,
			toxicityScore: 0.1,
			inappropriateScore: 0.1,
			recommendation: "approve" as const,
			reasoning: "Clean content",
		};
		mockGetJSON.mockResolvedValue(cachedResult);

		const post = makeMockPost();
		mockPostFindById.mockResolvedValue(post);

		await handler({
			postId: new Types.ObjectId().toString(),
			content: "This content is perfectly fine and totally safe for everyone",
			authorId: testUser._id!.toString(),
		});

		expect(mockModerateContent).not.toHaveBeenCalled();
		expect(mockSetJSON).not.toHaveBeenCalled();
		expect(post.moderationStatus).toBe("approved");
	});

	it("calls AIService.moderateContent on cache miss", async () => {
		mockGetJSON.mockResolvedValue(null);
		const apiResult = {
			isSpam: false,
			isToxic: false,
			isInappropriate: false,
			spamScore: 0.1,
			toxicityScore: 0.1,
			inappropriateScore: 0.1,
			recommendation: "approve" as const,
			reasoning: "All good",
		};
		mockModerateContent.mockResolvedValue(apiResult);
		const post = makeMockPost();
		mockPostFindById.mockResolvedValue(post);

		await handler({
			postId: new Types.ObjectId().toString(),
			content: "This is perfectly normal content for testing purposes",
			authorId: testUser._id!.toString(),
		});

		expect(mockModerateContent).toHaveBeenCalledTimes(1);
	});

	it("calls cacheService.setJSON with 86400 TTL after a real API call", async () => {
		mockGetJSON.mockResolvedValue(null);
		const apiResult = {
			isSpam: false,
			isToxic: false,
			isInappropriate: false,
			spamScore: 0.1,
			toxicityScore: 0.1,
			inappropriateScore: 0.1,
			recommendation: "approve" as const,
			reasoning: "All good",
		};
		mockModerateContent.mockResolvedValue(apiResult);
		const post = makeMockPost();
		mockPostFindById.mockResolvedValue(post);

		await handler({
			postId: new Types.ObjectId().toString(),
			content: "This is perfectly normal content for testing purposes",
			authorId: testUser._id!.toString(),
		});

		expect(mockSetJSON).toHaveBeenCalledTimes(1);
		expect(mockSetJSON).toHaveBeenCalledWith(
			"ai:moderation:result:abc123hash",
			apiResult,
			86400,
		);
	});

	it("does NOT call cacheService.setJSON on cache hit", async () => {
		const cachedResult = {
			isSpam: false,
			isToxic: false,
			isInappropriate: false,
			spamScore: 0.05,
			toxicityScore: 0.05,
			inappropriateScore: 0.05,
			recommendation: "approve" as const,
			reasoning: "Cached",
		};
		mockGetJSON.mockResolvedValue(cachedResult);
		const post = makeMockPost();
		mockPostFindById.mockResolvedValue(post);

		await handler({
			postId: new Types.ObjectId().toString(),
			content: "This is some content that has a cached result already",
			authorId: testUser._id!.toString(),
		});

		expect(mockSetJSON).not.toHaveBeenCalled();
	});

	it("uses the correct cache key derived from hashContent", async () => {
		mockHashContent.mockReturnValue("deadbeefcafebabe1234");
		mockGetJSON.mockResolvedValue(null);
		const apiResult = {
			isSpam: false,
			isToxic: false,
			isInappropriate: false,
			spamScore: 0.1,
			toxicityScore: 0.1,
			inappropriateScore: 0.1,
			recommendation: "approve" as const,
			reasoning: "Fine",
		};
		mockModerateContent.mockResolvedValue(apiResult);
		const post = makeMockPost();
		mockPostFindById.mockResolvedValue(post);

		await handler({
			postId: new Types.ObjectId().toString(),
			content: "Content whose hash is mocked",
			authorId: testUser._id!.toString(),
		});

		expect(mockGetJSON).toHaveBeenCalledWith("ai:moderation:result:deadbeefcafebabe1234");
		expect(mockSetJSON).toHaveBeenCalledWith(
			"ai:moderation:result:deadbeefcafebabe1234",
			apiResult,
			86400,
		);
	});
});

describe("AI Moderation Worker — final moderation outcomes (Stage C)", () => {
	let handler: Awaited<ReturnType<typeof getWorkerHandler>>;
	let testUser: Awaited<ReturnType<typeof createTestUser>>;

	beforeEach(async () => {
		jest.clearAllMocks();
		mockPostSave.mockResolvedValue(undefined);
		mockReportCreate.mockResolvedValue({});
		mockCreateAIModerationRejectedNotification.mockResolvedValue(undefined);
		mockCreateAIModerationFlaggedNotification.mockResolvedValue(undefined);
		mockCheckContentLocally.mockReturnValue("api");
		mockHashContent.mockReturnValue("testhash");
		// Default: cache miss so AIService is called
		mockGetJSON.mockResolvedValue(null);
		testUser = await createTestUser();
		handler = await getWorkerHandler();
	});

	afterEach(() => jest.clearAllMocks());

	it("sets moderationStatus to 'approved' when API returns recommendation 'approve'", async () => {
		mockModerateContent.mockResolvedValue({
			isSpam: false,
			isToxic: false,
			isInappropriate: false,
			spamScore: 0.1,
			toxicityScore: 0.1,
			inappropriateScore: 0.1,
			recommendation: "approve",
			reasoning: "Looks clean",
		});
		const post = makeMockPost();
		mockPostFindById.mockResolvedValue(post);

		await handler({
			postId: new Types.ObjectId().toString(),
			content: "This is a perfectly normal and safe post content",
			authorId: testUser._id!.toString(),
		});

		expect(post.moderationStatus).toBe("approved");
		expect(mockReportCreate).not.toHaveBeenCalled();
		expect(mockCreateAIModerationRejectedNotification).not.toHaveBeenCalled();
	});

	it("sets moderationStatus to 'flagged' and creates Report when API returns 'review'", async () => {
		mockModerateContent.mockResolvedValue({
			isSpam: true,
			isToxic: false,
			isInappropriate: false,
			spamScore: 0.5,
			toxicityScore: 0.2,
			inappropriateScore: 0.2,
			recommendation: "review",
			reasoning: "Slightly spammy",
		});
		const post = makeMockPost();
		mockPostFindById.mockResolvedValue(post);
		mockThreadFindById.mockResolvedValue({ _id: new Types.ObjectId(), title: "Some Thread" });

		await handler({
			postId: new Types.ObjectId().toString(),
			content: "This content is a bit suspicious and needs human review",
			authorId: testUser._id!.toString(),
		});

		expect(post.moderationStatus).toBe("flagged");
		expect(mockReportCreate).toHaveBeenCalledTimes(1);
		expect(mockReportCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				reportedContentType: "post",
				reportType: "spam",
				status: "pending",
			}),
		);
	});

	it("sends flagged notification when API returns 'review'", async () => {
		mockModerateContent.mockResolvedValue({
			isSpam: false,
			isToxic: true,
			isInappropriate: false,
			spamScore: 0.2,
			toxicityScore: 0.4,
			inappropriateScore: 0.2,
			recommendation: "review",
			reasoning: "Borderline toxic",
		});
		const post = makeMockPost();
		const threadId = new Types.ObjectId();
		post.threadId = threadId;
		mockPostFindById.mockResolvedValue(post);
		const thread = { _id: threadId, title: "Discussion Thread" };
		mockThreadFindById.mockResolvedValue(thread);

		const authorId = testUser._id!.toString();

		await handler({
			postId: new Types.ObjectId().toString(),
			content: "Content that is borderline and needs further human review",
			authorId,
		});

		expect(mockCreateAIModerationFlaggedNotification).toHaveBeenCalledTimes(1);
	});

	it("sets moderationStatus to 'rejected' and status to 'deleted' when API returns 'reject'", async () => {
		mockModerateContent.mockResolvedValue({
			isSpam: false,
			isToxic: true,
			isInappropriate: false,
			spamScore: 0.1,
			toxicityScore: 0.9,
			inappropriateScore: 0.1,
			recommendation: "reject",
			reasoning: "Highly toxic content",
		});
		const post = makeMockPost();
		mockPostFindById.mockResolvedValue(post);
		mockThreadFindById.mockResolvedValue({ _id: new Types.ObjectId(), title: "Forum Thread" });

		await handler({
			postId: new Types.ObjectId().toString(),
			content: "This is a very toxic and harmful message that must be rejected",
			authorId: testUser._id!.toString(),
		});

		expect(post.moderationStatus).toBe("rejected");
		expect(post.status).toBe("deleted");
	});

	it("creates a Report when API returns 'reject'", async () => {
		mockModerateContent.mockResolvedValue({
			isSpam: false,
			isToxic: true,
			isInappropriate: false,
			spamScore: 0.1,
			toxicityScore: 0.9,
			inappropriateScore: 0.1,
			recommendation: "reject",
			reasoning: "Highly toxic content",
		});
		const post = makeMockPost();
		mockPostFindById.mockResolvedValue(post);
		mockThreadFindById.mockResolvedValue({ _id: new Types.ObjectId(), title: "Forum Thread" });

		await handler({
			postId: new Types.ObjectId().toString(),
			content: "This is a very toxic and harmful message that must be rejected",
			authorId: testUser._id!.toString(),
		});

		expect(mockReportCreate).toHaveBeenCalledTimes(1);
		expect(mockReportCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				reportedContentType: "post",
				reportType: "harassment",
				status: "reviewing",
			}),
		);
	});

	it("sends rejection notification when API returns 'reject'", async () => {
		mockModerateContent.mockResolvedValue({
			isSpam: false,
			isToxic: true,
			isInappropriate: false,
			spamScore: 0.1,
			toxicityScore: 0.9,
			inappropriateScore: 0.1,
			recommendation: "reject",
			reasoning: "Extremely toxic",
		});
		const post = makeMockPost();
		const threadId = new Types.ObjectId();
		post.threadId = threadId;
		mockPostFindById.mockResolvedValue(post);
		const thread = { _id: threadId, title: "My Forum Thread" };
		mockThreadFindById.mockResolvedValue(thread);

		const authorId = testUser._id!.toString();
		const postId = new Types.ObjectId().toString();

		await handler({ postId, content: "Extremely toxic and harmful content here", authorId });

		expect(mockCreateAIModerationRejectedNotification).toHaveBeenCalledTimes(1);
		expect(mockCreateAIModerationRejectedNotification).toHaveBeenCalledWith(
			authorId,
			postId,
			expect.any(String),
			thread.title,
			"Extremely toxic",
		);
	});

	it("saves post after setting AI moderation fields", async () => {
		mockModerateContent.mockResolvedValue({
			isSpam: false,
			isToxic: false,
			isInappropriate: false,
			spamScore: 0.05,
			toxicityScore: 0.05,
			inappropriateScore: 0.05,
			recommendation: "approve",
			reasoning: "Clean",
		});
		const post = makeMockPost();
		mockPostFindById.mockResolvedValue(post);

		await handler({
			postId: new Types.ObjectId().toString(),
			content: "This is a totally clean and safe post message",
			authorId: testUser._id!.toString(),
		});

		expect(mockPostSave).toHaveBeenCalledTimes(1);
		expect(post.aiScore).toEqual({
			spam: 0.05,
			toxicity: 0.05,
			inappropriate: 0.05,
		});
		expect(post.aiReasoning).toBe("Clean");
		expect(post.aiRecommendation).toBe("approve");
	});

	it("returns early without crash when post not found after cache/API stage", async () => {
		mockModerateContent.mockResolvedValue({
			isSpam: false,
			isToxic: false,
			isInappropriate: false,
			spamScore: 0.1,
			toxicityScore: 0.1,
			inappropriateScore: 0.1,
			recommendation: "approve",
			reasoning: "Fine",
		});
		mockPostFindById.mockResolvedValue(null);

		await expect(
			handler({
				postId: new Types.ObjectId().toString(),
				content: "Some content that is long enough to pass local filter",
				authorId: testUser._id!.toString(),
			}),
		).resolves.toBeUndefined();

		expect(mockPostSave).not.toHaveBeenCalled();
	});

	it("skips notification when thread not found after API reject", async () => {
		mockModerateContent.mockResolvedValue({
			isSpam: true,
			isToxic: false,
			isInappropriate: false,
			spamScore: 0.9,
			toxicityScore: 0.1,
			inappropriateScore: 0.1,
			recommendation: "reject",
			reasoning: "Spam",
		});
		const post = makeMockPost();
		mockPostFindById.mockResolvedValue(post);
		mockThreadFindById.mockResolvedValue(null);

		await handler({
			postId: new Types.ObjectId().toString(),
			content: "This spam content must be rejected by the system right now",
			authorId: testUser._id!.toString(),
		});

		expect(mockCreateAIModerationRejectedNotification).not.toHaveBeenCalled();
		expect(mockReportCreate).toHaveBeenCalledTimes(1);
	});
});

describe("AI Moderation Worker — error handling and stopWorker", () => {
	let handler: Awaited<ReturnType<typeof getWorkerHandler>>;
	let testUser: Awaited<ReturnType<typeof createTestUser>>;

	beforeEach(async () => {
		jest.clearAllMocks();
		mockPostSave.mockResolvedValue(undefined);
		mockCheckContentLocally.mockReturnValue("api");
		mockHashContent.mockReturnValue("testhash");
		mockGetJSON.mockResolvedValue(null);
		testUser = await createTestUser();
		handler = await getWorkerHandler();
	});

	afterEach(() => jest.clearAllMocks());

	it("rethrows errors from the message handler (error catch block)", async () => {
		const boom = new Error("DB failure");
		mockModerateContent.mockRejectedValue(boom);

		await expect(
			handler({
				postId: new Types.ObjectId().toString(),
				content: "This is a long enough content to reach the api stage",
				authorId: testUser._id!.toString(),
			}),
		).rejects.toThrow("DB failure");
	});

	it("stopAIModerationWorker resolves without error", async () => {
		const { stopAIModerationWorker } = await import("../ai-moderation.worker");
		await expect(stopAIModerationWorker()).resolves.toBeUndefined();
	});
});
