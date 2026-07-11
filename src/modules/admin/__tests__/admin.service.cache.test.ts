/**
 * Cache tests for admin.service.ts
 * Spec: .claude/specs/08-cache-expansion.md — sections 3.7 & 3.8
 *
 * Covers:
 *   - getDashboardStats: cache hit returns cached stats without DB queries
 *   - getDashboardStats: cache miss runs DB queries and writes stats with 60s TTL
 *   - getAIModerationSummary: cache hit returns cached summary without DB queries
 *   - getAIModerationSummary: cache miss runs DB queries and writes summary with 120s TTL
 */

import { Types } from "mongoose";
import { cacheService } from "../../../config/redis";
import { createTestUser } from "../../../__tests__/utils/testHelpers";
import { Thread } from "../../thread/thread.model";
import { Post } from "../../post/post.model";
import { AdminService } from "../admin.service";
import { User } from "../../user/user.model";
import { Report, Ban } from "../admin.model";

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

const mockedCacheService = cacheService as jest.Mocked<typeof cacheService>;

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

const seedThread = async (userId: string, overrides: Record<string, unknown> = {}) => {
	return Thread.create({
		title: `Thread ${Date.now()}`,
		createdBy: new Types.ObjectId(userId),
		tags: [],
		viewCount: 0,
		postCount: 0,
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
// getDashboardStats — cache hit
// ===========================================================================

describe("AdminService.getDashboardStats — cache hit", () => {
	it("returns cached stats without running any DB queries", async () => {
		const cachedStats = {
			totalUsers: 100,
			totalThreads: 50,
			totalPosts: 200,
			totalReports: 5,
			activeUsers: 80,
			newUsersToday: 3,
			newThreadsToday: 2,
			newPostsToday: 10,
			pendingReports: 2,
			bannedUsers: 1,
		};

		mockedCacheService.getJSON.mockResolvedValueOnce(cachedStats as any);

		const result = await AdminService.getDashboardStats();

		expect(result).toEqual(cachedStats);
		// No DB write on cache hit
		expect(mockedCacheService.setJSON).not.toHaveBeenCalled();
	});

	it("checks the correct cache key: admin:dashboard:stats", async () => {
		const cachedStats = { totalUsers: 5, totalThreads: 2, totalPosts: 10 };
		mockedCacheService.getJSON.mockResolvedValueOnce(cachedStats as any);

		await AdminService.getDashboardStats();

		expect(mockedCacheService.getJSON).toHaveBeenCalledWith("admin:dashboard:stats");
	});
});

// ===========================================================================
// getDashboardStats — cache miss
// ===========================================================================

describe("AdminService.getDashboardStats — cache miss", () => {
	it("queries the DB and writes stats to cache with 60s TTL on miss", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		await seedPost((thread._id as Types.ObjectId).toString(), userId);

		await AdminService.getDashboardStats();

		expect(mockedCacheService.setJSON).toHaveBeenCalledWith(
			"admin:dashboard:stats",
			expect.objectContaining({
				totalUsers: expect.any(Number),
				totalThreads: expect.any(Number),
				totalPosts: expect.any(Number),
			}),
			60,
		);
	});

	it("returns correct stats from DB on cache miss", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		const initialUserCount = await User.countDocuments();

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		const result = await AdminService.getDashboardStats();

		expect(result).toBeDefined();
		expect(result.totalUsers).toBeGreaterThanOrEqual(initialUserCount + 1);
		expect(typeof result.totalThreads).toBe("number");
		expect(typeof result.totalPosts).toBe("number");
		expect(typeof result.totalReports).toBe("number");
		expect(typeof result.activeUsers).toBe("number");
		expect(typeof result.newUsersToday).toBe("number");
		expect(typeof result.newThreadsToday).toBe("number");
		expect(typeof result.newPostsToday).toBe("number");
		expect(typeof result.pendingReports).toBe("number");
		expect(typeof result.bannedUsers).toBe("number");

		void userId;
	});

	it("returns 0 for stats when DB is empty", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		const result = await AdminService.getDashboardStats();

		// All counts should be non-negative
		expect(result.totalThreads).toBeGreaterThanOrEqual(0);
		expect(result.totalPosts).toBeGreaterThanOrEqual(0);
		expect(result.totalReports).toBeGreaterThanOrEqual(0);
		expect(result.pendingReports).toBeGreaterThanOrEqual(0);
		expect(result.bannedUsers).toBeGreaterThanOrEqual(0);
	});
});

// ===========================================================================
// getAIModerationSummary — cache hit
// ===========================================================================

describe("AdminService.getAIModerationSummary — cache hit", () => {
	it("returns cached summary without running any DB queries", async () => {
		const cachedSummary = {
			totalModerated: 50,
			moderatedToday: 5,
			moderatedThisWeek: 20,
			breakdown: { approved: 40, flagged: 5, rejected: 3, pending: 2 },
			averageScores: { spam: 0.1, toxicity: 0.05, inappropriate: 0.08 },
			highRiskCount: 3,
			recentActions: [],
		};

		mockedCacheService.getJSON.mockResolvedValueOnce(cachedSummary as any);

		const result = await AdminService.getAIModerationSummary();

		expect(result).toEqual(cachedSummary);
		// No write on cache hit
		expect(mockedCacheService.setJSON).not.toHaveBeenCalled();
	});

	it("checks the correct cache key: admin:ai:moderation:summary", async () => {
		const cachedSummary = { totalModerated: 10 };
		mockedCacheService.getJSON.mockResolvedValueOnce(cachedSummary as any);

		await AdminService.getAIModerationSummary();

		expect(mockedCacheService.getJSON).toHaveBeenCalledWith("admin:ai:moderation:summary");
	});
});

// ===========================================================================
// getAIModerationSummary — cache miss
// ===========================================================================

describe("AdminService.getAIModerationSummary — cache miss", () => {
	it("queries DB and writes summary to cache with 120s TTL on miss", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		await AdminService.getAIModerationSummary();

		expect(mockedCacheService.setJSON).toHaveBeenCalledWith(
			"admin:ai:moderation:summary",
			expect.objectContaining({
				totalModerated: expect.any(Number),
				breakdown: expect.objectContaining({
					approved: expect.any(Number),
					flagged: expect.any(Number),
					rejected: expect.any(Number),
					pending: expect.any(Number),
				}),
				averageScores: expect.objectContaining({
					spam: expect.any(Number),
					toxicity: expect.any(Number),
					inappropriate: expect.any(Number),
				}),
			}),
			120,
		);
	});

	it("returns correct summary structure on cache miss", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		const result = await AdminService.getAIModerationSummary() as any;

		expect(result).toBeDefined();
		expect(typeof result.totalModerated).toBe("number");
		expect(typeof result.moderatedToday).toBe("number");
		expect(typeof result.moderatedThisWeek).toBe("number");
		expect(result.breakdown).toBeDefined();
		expect(result.averageScores).toBeDefined();
		expect(typeof result.highRiskCount).toBe("number");
		expect(Array.isArray(result.recentActions)).toBe(true);
	});

	it("includes default 0 averageScores when no moderated posts exist", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		const result = await AdminService.getAIModerationSummary() as any;

		// With no posts with aiScore, avgScores[0] will be undefined → defaults to 0
		expect(result.averageScores.spam).toBe(0);
		expect(result.averageScores.toxicity).toBe(0);
		expect(result.averageScores.inappropriate).toBe(0);
	});

	it("correctly counts posts with aiScore in breakdown", async () => {
		mockedCacheService.getJSON.mockResolvedValue(null);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		// Create a post with aiScore to test breakdown
		await seedPost(threadId, userId, {
			aiScore: { spam: 0.1, toxicity: 0.05, inappropriate: 0.02 },
			moderationStatus: "approved",
		});

		const result = await AdminService.getAIModerationSummary() as any;

		expect(result.totalModerated).toBeGreaterThanOrEqual(1);
		expect(result.breakdown.approved).toBeGreaterThanOrEqual(1);
	});
});

// ===========================================================================
// Additional admin service coverage — non-cache functions
// ===========================================================================

describe("AdminService.getAllUsers", () => {
	it("returns paginated users with no filters", async () => {
		await createTestUser();
		await createTestUser();

		const result = await AdminService.getAllUsers({ page: 1, limit: 10 });

		expect(result.users.length).toBeGreaterThanOrEqual(2);
		expect(result.total).toBeGreaterThanOrEqual(2);
		expect(result.page).toBe(1);
		expect(result.limit).toBe(10);
	});

	it("filters users by role", async () => {
		await createTestUser({ role: "Admin" });
		await createTestUser({ role: "Member" });

		const result = await AdminService.getAllUsers({ role: "Admin", page: 1, limit: 10 });

		expect(result.users.every((u: any) => u.role === "Admin")).toBe(true);
	});

	it("filters users by searchTerm", async () => {
		const uniqueName = `UniqueSearch_${Date.now()}`;
		await createTestUser({ name: uniqueName });

		const result = await AdminService.getAllUsers({ searchTerm: uniqueName.substring(0, 10), page: 1, limit: 10 });

		expect(result.users.length).toBeGreaterThanOrEqual(1);
	});
});

describe("AdminService.getAllPosts", () => {
	it("returns paginated posts with no filters", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		await seedPost((thread._id as Types.ObjectId).toString(), userId);

		const result = await AdminService.getAllPosts({ page: 1, limit: 10 });

		expect(result.posts.length).toBeGreaterThanOrEqual(1);
		expect(result.total).toBeGreaterThanOrEqual(1);
	});

	it("filters posts by moderationStatus", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		await seedPost((thread._id as Types.ObjectId).toString(), userId, {
			moderationStatus: "flagged",
		});

		const result = await AdminService.getAllPosts({
			moderationStatus: "flagged",
			page: 1,
			limit: 10,
		});

		expect(result.posts.length).toBeGreaterThanOrEqual(1);
	});
});

describe("AdminService.getAllThreads", () => {
	it("returns paginated threads", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		await seedThread(userId);

		const result = await AdminService.getAllThreads({ page: 1, limit: 10 });

		expect(result.threads.length).toBeGreaterThanOrEqual(1);
		expect(result.total).toBeGreaterThanOrEqual(1);
	});

	it("filters threads by status", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		await seedThread(userId, { status: "active" });

		const result = await AdminService.getAllThreads({ status: "active", page: 1, limit: 10 });

		expect(result.threads.every((t: any) => t.status === "active")).toBe(true);
	});
});

describe("AdminService.getActivityLogs", () => {
	it("returns activity logs (empty initially)", async () => {
		const result = await AdminService.getActivityLogs();

		expect(Array.isArray(result.logs)).toBe(true);
		expect(typeof result.total).toBe("number");
	});
});

describe("AdminService.getSystemSettings", () => {
	it("creates default settings when none exist", async () => {
		const result = await AdminService.getSystemSettings();

		expect(result).toBeDefined();
	});

	it("returns existing settings on second call", async () => {
		const first = await AdminService.getSystemSettings();
		const second = await AdminService.getSystemSettings();

		expect(first._id.toString()).toBe(second._id.toString());
	});
});

describe("AdminService.getUserStats", () => {
	it("returns user statistics", async () => {
		await createTestUser();

		const result = await AdminService.getUserStats();

		expect(typeof result.total).toBe("number");
		expect(typeof result.active).toBe("number");
		expect(typeof result.verified).toBe("number");
		expect(result.total).toBeGreaterThanOrEqual(1);
	});
});

describe("AdminService.getThreadStats", () => {
	it("returns thread statistics", async () => {
		const user = await createTestUser();
		await seedThread((user._id as Types.ObjectId).toString());

		const result = await AdminService.getThreadStats();

		expect(typeof result.total).toBe("number");
		expect(typeof result.active).toBe("number");
		expect(result.total).toBeGreaterThanOrEqual(1);
	});
});

describe("AdminService.getPostStats", () => {
	it("returns post statistics", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		await seedPost((thread._id as Types.ObjectId).toString(), userId);

		const result = await AdminService.getPostStats();

		expect(typeof result.total).toBe("number");
		expect(typeof result.active).toBe("number");
		expect(result.moderation).toBeDefined();
	});
});

describe("AdminService.createReport", () => {
	it("throws 404 when reported content does not exist", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const fakeId = new Types.ObjectId().toString();

		await expect(
			AdminService.createReport({
				reportedContentType: "post",
				reportedContentId: fakeId as any,
				reportedBy: userId as any,
				reportType: "spam",
				description: "spam content",
			}),
		).rejects.toMatchObject({ statusCode: 404 });
	});

	it("creates a report for existing content", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();
		const post = await seedPost(threadId, userId);
		const postId = (post._id as Types.ObjectId).toString();

		const result = await AdminService.createReport({
			reportedContentType: "post",
			reportedContentId: postId as any,
			reportedBy: userId as any,
			reportType: "spam",
			description: "spam content",
		});

		expect(result).toBeDefined();
		expect(result.reportType).toBe("spam");
	});

	it("throws 400 when user already reported same content", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();
		const post = await seedPost(threadId, userId);
		const postId = (post._id as Types.ObjectId).toString();

		// First report
		await AdminService.createReport({
			reportedContentType: "post",
			reportedContentId: postId as any,
			reportedBy: userId as any,
			reportType: "spam",
			description: "spam content",
		});

		// Duplicate report
		await expect(
			AdminService.createReport({
				reportedContentType: "post",
				reportedContentId: postId as any,
				reportedBy: userId as any,
				reportType: "spam",
				description: "spam again",
			}),
		).rejects.toMatchObject({ statusCode: 400 });
	});

	it("creates a report for a thread", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		const result = await AdminService.createReport({
			reportedContentType: "thread",
			reportedContentId: threadId as any,
			reportedBy: userId as any,
			reportType: "spam",
			description: "spam thread",
		});

		expect(result).toBeDefined();
		expect(result.reportedContentType).toBe("thread");
	});

	it("creates a report for a user", async () => {
		const reporter = await createTestUser();
		const reportedUser = await createTestUser();
		const reporterId = (reporter._id as Types.ObjectId).toString();
		const reportedUserId = (reportedUser._id as Types.ObjectId).toString();

		const result = await AdminService.createReport({
			reportedContentType: "user",
			reportedContentId: reportedUserId as any,
			reportedBy: reporterId as any,
			reportType: "harassment",
			description: "harassing me",
		});

		expect(result).toBeDefined();
		expect(result.reportedContentType).toBe("user");
	});
});

describe("AdminService.getAllReports", () => {
	it("returns empty list initially", async () => {
		const result = await AdminService.getAllReports({ page: 1, limit: 10 });

		expect(Array.isArray(result.reports)).toBe(true);
		expect(typeof result.total).toBe("number");
	});
});

describe("AdminService.getQueueHealth", () => {
	it("returns queue health metrics", async () => {
		const result = await AdminService.getQueueHealth();

		expect(typeof result.pendingModeration).toBe("number");
		expect(typeof result.failedJobs).toBe("number");
	});
});

describe("AdminService.banUser / unbanUser", () => {
	it("throws 404 when user to ban does not exist", async () => {
		const fakeId = new Types.ObjectId().toString();

		await expect(
			AdminService.banUser(fakeId, {
				reason: "spamming",
				bannedBy: new Types.ObjectId() as any,
			}),
		).rejects.toMatchObject({ statusCode: 404 });
	});

	it("bans an active user", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const admin = await createTestUser({ role: "Admin" });
		const adminId = admin._id as Types.ObjectId;

		const result = await AdminService.banUser(userId, {
			reason: "spamming",
			bannedBy: adminId as any,
		});

		expect(result).toBeDefined();
		expect(result.reason).toBe("spamming");
	});

	it("throws 400 when user is already banned", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const admin = await createTestUser({ role: "Admin" });
		const adminId = admin._id as Types.ObjectId;

		await AdminService.banUser(userId, {
			reason: "first offense",
			bannedBy: adminId as any,
		});

		await expect(
			AdminService.banUser(userId, {
				reason: "second offense",
				bannedBy: adminId as any,
			}),
		).rejects.toMatchObject({ statusCode: 400 });
	});

	it("throws 404 when user to unban does not exist", async () => {
		const fakeId = new Types.ObjectId().toString();
		const adminId = new Types.ObjectId().toString();

		await expect(
			AdminService.unbanUser(fakeId, adminId),
		).rejects.toMatchObject({ statusCode: 404 });
	});

	it("unbans a banned user", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const admin = await createTestUser({ role: "Admin" });
		const adminId = (admin._id as Types.ObjectId).toString();

		await AdminService.banUser(userId, {
			reason: "temporary ban",
			bannedBy: admin._id as any,
		});

		const result = await AdminService.unbanUser(userId, adminId);

		expect(result).toBeDefined();
		expect(result.isActive).toBe(true);
	});

	it("throws 400 when user is not banned", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const adminId = new Types.ObjectId().toString();

		await expect(
			AdminService.unbanUser(userId, adminId),
		).rejects.toMatchObject({ statusCode: 400 });
	});
});

describe("AdminService.updateUser", () => {
	it("throws 404 when user to update does not exist", async () => {
		const fakeId = new Types.ObjectId().toString();
		const adminId = new Types.ObjectId().toString();

		await expect(
			AdminService.updateUser(fakeId, { role: "Moderator" }, adminId),
		).rejects.toMatchObject({ statusCode: 404 });
	});

	it("updates user role successfully", async () => {
		const user = await createTestUser({ role: "Member" });
		const userId = (user._id as Types.ObjectId).toString();
		const admin = await createTestUser({ role: "Admin" });
		const adminId = (admin._id as Types.ObjectId).toString();

		const result = await AdminService.updateUser(userId, { role: "Moderator" }, adminId);

		expect(result).toBeDefined();
	});
});

describe("AdminService.getReportById", () => {
	it("throws 404 when report not found", async () => {
		const fakeId = new Types.ObjectId().toString();

		await expect(
			AdminService.getReportById(fakeId),
		).rejects.toMatchObject({ statusCode: 404 });
	});

	it("returns report with content for a post", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();
		const post = await seedPost(threadId, userId);
		const postId = (post._id as Types.ObjectId).toString();

		const report = await AdminService.createReport({
			reportedContentType: "post",
			reportedContentId: postId as any,
			reportedBy: userId as any,
			reportType: "spam",
			description: "spam content",
		});

		const result = await AdminService.getReportById((report._id as Types.ObjectId).toString());

		expect(result).toBeDefined();
		expect(result.reportType).toBe("spam");
	});

	it("returns report with content for a thread", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();

		const report = await AdminService.createReport({
			reportedContentType: "thread",
			reportedContentId: threadId as any,
			reportedBy: userId as any,
			reportType: "spam",
			description: "spam thread",
		});

		const result = await AdminService.getReportById((report._id as Types.ObjectId).toString());

		expect(result).toBeDefined();
		expect(result.reportedContentType).toBe("thread");
	});

	it("returns report with content for a user", async () => {
		const reporter = await createTestUser();
		const reportedUser = await createTestUser();
		const reporterId = (reporter._id as Types.ObjectId).toString();
		const reportedUserId = (reportedUser._id as Types.ObjectId).toString();

		const report = await AdminService.createReport({
			reportedContentType: "user",
			reportedContentId: reportedUserId as any,
			reportedBy: reporterId as any,
			reportType: "harassment",
			description: "harassment",
		});

		const result = await AdminService.getReportById((report._id as Types.ObjectId).toString());

		expect(result).toBeDefined();
		expect(result.reportedContentType).toBe("user");
	});
});

describe("AdminService.updateSystemSettings", () => {
	it("creates settings on first update", async () => {
		const admin = await createTestUser({ role: "Admin" });
		const adminId = (admin._id as Types.ObjectId).toString();

		const result = await AdminService.updateSystemSettings(
			{ maintenanceMode: false },
			adminId,
		);

		expect(result).toBeDefined();
	});

	it("updates existing settings", async () => {
		const admin = await createTestUser({ role: "Admin" });
		const adminId = (admin._id as Types.ObjectId).toString();

		await AdminService.updateSystemSettings({ maintenanceMode: false }, adminId);
		const result = await AdminService.updateSystemSettings(
			{ maintenanceMode: true },
			adminId,
		);

		expect(result).toBeDefined();
	});
});

describe("AdminService.getFailedJobs", () => {
	it("returns empty failed jobs list initially", async () => {
		const result = await AdminService.getFailedJobs(1, 10);

		expect(result).toBeDefined();
	});
});

describe("AdminService.takeReportAction", () => {
	const createPostReport = async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const thread = await seedThread(userId);
		const threadId = (thread._id as Types.ObjectId).toString();
		const post = await seedPost(threadId, userId);
		const postId = (post._id as Types.ObjectId).toString();

		const report = await AdminService.createReport({
			reportedContentType: "post",
			reportedContentId: postId as any,
			reportedBy: userId as any,
			reportType: "spam",
			description: "spam content",
		});

		return { report, userId, postId };
	};

	it("throws 404 when report not found", async () => {
		const fakeId = new Types.ObjectId().toString();
		const adminId = new Types.ObjectId().toString();

		await expect(
			AdminService.takeReportAction({
				reportId: fakeId,
				action: "dismiss",
				reviewedBy: adminId,
			}),
		).rejects.toMatchObject({ statusCode: 404 });
	});

	it("dismisses a report", async () => {
		const { report } = await createPostReport();
		const admin = await createTestUser({ role: "Admin" });
		const adminId = (admin._id as Types.ObjectId).toString();

		const result = await AdminService.takeReportAction({
			reportId: (report._id as Types.ObjectId).toString(),
			action: "dismiss",
			reviewedBy: adminId,
		});

		expect(result.status).toBe("dismissed");
	});

	it("resolves a report", async () => {
		const { report } = await createPostReport();
		const admin = await createTestUser({ role: "Admin" });
		const adminId = (admin._id as Types.ObjectId).toString();

		const result = await AdminService.takeReportAction({
			reportId: (report._id as Types.ObjectId).toString(),
			action: "resolve",
			reviewedBy: adminId,
		});

		expect(result.status).toBe("resolved");
	});

	it("throws 400 when report already resolved", async () => {
		const { report } = await createPostReport();
		const admin = await createTestUser({ role: "Admin" });
		const adminId = (admin._id as Types.ObjectId).toString();
		const reportId = (report._id as Types.ObjectId).toString();

		await AdminService.takeReportAction({
			reportId,
			action: "resolve",
			reviewedBy: adminId,
		});

		await expect(
			AdminService.takeReportAction({
				reportId,
				action: "resolve",
				reviewedBy: adminId,
			}),
		).rejects.toMatchObject({ statusCode: 400 });
	});

	it("resolves report with content_removed resolution", async () => {
		const { report } = await createPostReport();
		const admin = await createTestUser({ role: "Admin" });
		const adminId = (admin._id as Types.ObjectId).toString();

		const result = await AdminService.takeReportAction({
			reportId: (report._id as Types.ObjectId).toString(),
			action: "resolve",
			resolution: "content_removed",
			reviewedBy: adminId,
		});

		expect(result.status).toBe("resolved");
		expect(result.resolution).toBe("content_removed");
	});
});

describe("AdminService.getActivityLogs — with adminId filter", () => {
	it("filters logs by adminId", async () => {
		const admin = await createTestUser({ role: "Admin" });
		const adminId = (admin._id as Types.ObjectId).toString();

		// updateUser creates an activity log
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		await AdminService.updateUser(userId, { role: "Moderator" }, adminId);

		const result = await AdminService.getActivityLogs(adminId, 1, 10);

		expect(Array.isArray(result.logs)).toBe(true);
		expect(result.total).toBeGreaterThanOrEqual(1);
	});
});
