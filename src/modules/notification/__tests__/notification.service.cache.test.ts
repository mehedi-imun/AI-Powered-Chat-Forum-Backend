/**
 * Cache tests for notification.service.ts
 * Spec: .claude/specs/08-cache-expansion.md — section 3.6
 *
 * Covers:
 *   - getUnreadCount: cache hit returns parsed integer without DB call
 *   - getUnreadCount: cache miss runs countDocuments and writes to cache with 30s TTL
 *   - createNotification: invalidates unread count cache
 *   - markAsRead: invalidates unread count cache
 *   - markAllAsRead: invalidates unread count cache
 */

import { Types } from "mongoose";
import { cacheService } from "../../../config/redis";
import { createTestUser } from "../../../__tests__/utils/testHelpers";
import { Notification } from "../notification.model";
import { NotificationService } from "../notification.service";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock("../../../config/redis", () => ({
	cacheService: {
		get: jest.fn(),
		set: jest.fn().mockResolvedValue(true),
		del: jest.fn().mockResolvedValue(true),
		exists: jest.fn(),
		getJSON: jest.fn(),
		setJSON: jest.fn().mockResolvedValue(true),
	},
	getRedisClient: jest.fn(),
}));

jest.mock("../../../config/socket", () => ({
	getIO: jest.fn().mockReturnValue(null),
	initSocket: jest.fn(),
	emitToThread: jest.fn(),
	emitToUser: jest.fn(),
}));

const mockedCacheService = cacheService as jest.Mocked<typeof cacheService>;

// ---------------------------------------------------------------------------
// Seed helper
// ---------------------------------------------------------------------------

const seedNotification = async (
	userId: string,
	overrides: Record<string, unknown> = {},
) => {
	return Notification.create({
		userId: new Types.ObjectId(userId),
		type: "post_created",
		title: "Test Notification",
		message: "This is a test notification",
		isRead: false,
		...overrides,
	});
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => jest.clearAllMocks());

// ===========================================================================
// getUnreadCount — cache hit
// ===========================================================================

describe("NotificationService.getUnreadCount — cache hit", () => {
	it("returns cached integer when a non-null value is in cache", async () => {
		// Simulate cached count "7"
		mockedCacheService.get.mockResolvedValueOnce("7");

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		const result = await NotificationService.getUnreadCount(userId);

		expect(result).toBe(7);
		// No DB call and no write on hit
		expect(mockedCacheService.set).not.toHaveBeenCalled();
	});

	it("checks the correct cache key: notifications:unread:{userId}", async () => {
		mockedCacheService.get.mockResolvedValueOnce("3");

		const userId = new Types.ObjectId().toString();
		await NotificationService.getUnreadCount(userId);

		expect(mockedCacheService.get).toHaveBeenCalledWith(
			`notifications:unread:${userId}`,
		);
	});

	it("correctly parses the cached string to an integer", async () => {
		mockedCacheService.get.mockResolvedValueOnce("42");

		const userId = new Types.ObjectId().toString();
		const result = await NotificationService.getUnreadCount(userId);

		expect(result).toBe(42);
		expect(typeof result).toBe("number");
	});

	it("returns 0 when cache holds '0'", async () => {
		mockedCacheService.get.mockResolvedValueOnce("0");

		const userId = new Types.ObjectId().toString();
		const result = await NotificationService.getUnreadCount(userId);

		expect(result).toBe(0);
	});
});

// ===========================================================================
// getUnreadCount — cache miss
// ===========================================================================

describe("NotificationService.getUnreadCount — cache miss", () => {
	it("runs countDocuments and writes count to cache with 30s TTL on miss", async () => {
		// Cache miss
		mockedCacheService.get.mockResolvedValue(null);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		// Seed 3 unread notifications
		await seedNotification(userId);
		await seedNotification(userId);
		await seedNotification(userId);

		const result = await NotificationService.getUnreadCount(userId);

		expect(result).toBe(3);
		expect(mockedCacheService.set).toHaveBeenCalledWith(
			`notifications:unread:${userId}`,
			"3",
			30,
		);
	});

	it("returns 0 and caches '0' when user has no unread notifications", async () => {
		mockedCacheService.get.mockResolvedValue(null);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		const result = await NotificationService.getUnreadCount(userId);

		expect(result).toBe(0);
		expect(mockedCacheService.set).toHaveBeenCalledWith(
			`notifications:unread:${userId}`,
			"0",
			30,
		);
	});

	it("does not count read notifications", async () => {
		mockedCacheService.get.mockResolvedValue(null);

		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		await seedNotification(userId, { isRead: false });
		await seedNotification(userId, { isRead: true }); // should not count

		const result = await NotificationService.getUnreadCount(userId);

		expect(result).toBe(1);
	});
});

// ===========================================================================
// createNotification — cache invalidation
// ===========================================================================

describe("NotificationService.createNotification — cache invalidation", () => {
	it("invalidates unread count cache after creating a notification", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		await NotificationService.createNotification({
			userId,
			type: "post_created",
			title: "New Post",
			message: "Your post is live",
		});

		expect(mockedCacheService.del).toHaveBeenCalledWith(
			`notifications:unread:${userId}`,
		);
	});

	it("invalidates the cache for the notification recipient's userId", async () => {
		const recipient = await createTestUser();
		const sender = await createTestUser();
		const recipientId = (recipient._id as Types.ObjectId).toString();
		const senderId = (sender._id as Types.ObjectId).toString();

		await NotificationService.createNotification({
			userId: recipientId,
			type: "mention",
			title: "You were mentioned",
			message: "Someone mentioned you",
			relatedUserId: senderId,
		});

		// Cache of recipient should be invalidated (not sender)
		expect(mockedCacheService.del).toHaveBeenCalledWith(
			`notifications:unread:${recipientId}`,
		);
		expect(mockedCacheService.del).not.toHaveBeenCalledWith(
			`notifications:unread:${senderId}`,
		);
	});
});

// ===========================================================================
// markAsRead — cache invalidation
// ===========================================================================

describe("NotificationService.markAsRead — cache invalidation", () => {
	it("invalidates unread count cache after marking a notification as read", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		const notification = await seedNotification(userId, { isRead: false });
		const notificationId = (notification._id as Types.ObjectId).toString();

		await NotificationService.markAsRead(notificationId, userId);

		expect(mockedCacheService.del).toHaveBeenCalledWith(
			`notifications:unread:${userId}`,
		);
	});

	it("does not invalidate cache when notification is already read", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		const notification = await seedNotification(userId, { isRead: true });
		const notificationId = (notification._id as Types.ObjectId).toString();

		// markAsRead only invalidates when !notification.isRead before the update
		await NotificationService.markAsRead(notificationId, userId);

		// del should NOT be called because isRead was already true
		expect(mockedCacheService.del).not.toHaveBeenCalledWith(
			`notifications:unread:${userId}`,
		);
	});

	it("throws 404 when notification is not found", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const fakeId = new Types.ObjectId().toString();

		await expect(
			NotificationService.markAsRead(fakeId, userId),
		).rejects.toMatchObject({
			statusCode: 404,
			message: "Notification not found",
		});
	});
});

// ===========================================================================
// markAllAsRead — cache invalidation
// ===========================================================================

describe("NotificationService.markAllAsRead — cache invalidation", () => {
	it("invalidates unread count cache after marking all notifications as read", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		await seedNotification(userId);
		await seedNotification(userId);

		await NotificationService.markAllAsRead(userId);

		expect(mockedCacheService.del).toHaveBeenCalledWith(
			`notifications:unread:${userId}`,
		);
	});

	it("invalidates cache even when there are no unread notifications", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		// No unread notifications exist — markAllAsRead still invalidates cache
		await NotificationService.markAllAsRead(userId);

		expect(mockedCacheService.del).toHaveBeenCalledWith(
			`notifications:unread:${userId}`,
		);
	});

	it("returns the count of modified notifications", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		await seedNotification(userId, { isRead: false });
		await seedNotification(userId, { isRead: false });
		await seedNotification(userId, { isRead: true }); // already read

		const result = await NotificationService.markAllAsRead(userId);

		expect(result.modifiedCount).toBe(2);
	});
});

// ===========================================================================
// deleteNotification — cache invalidation
// ===========================================================================

describe("NotificationService.deleteNotification — cache invalidation", () => {
	it("invalidates unread count cache after deleting a notification", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		const notification = await seedNotification(userId, { isRead: false });
		const notificationId = (notification._id as Types.ObjectId).toString();

		await NotificationService.deleteNotification(notificationId, userId);

		expect(mockedCacheService.del).toHaveBeenCalledWith(
			`notifications:unread:${userId}`,
		);
	});

	it("throws 404 when notification to delete does not exist", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const fakeId = new Types.ObjectId().toString();

		await expect(
			NotificationService.deleteNotification(fakeId, userId),
		).rejects.toMatchObject({
			statusCode: 404,
			message: "Notification not found",
		});

		// Cache should not be invalidated if notification was not found
		expect(mockedCacheService.del).not.toHaveBeenCalled();
	});
});

// ===========================================================================
// getUserNotifications — basic coverage
// ===========================================================================

describe("NotificationService.getUserNotifications", () => {
	it("returns paginated notifications for a user", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		await seedNotification(userId);
		await seedNotification(userId, { isRead: true });

		const result = await NotificationService.getUserNotifications(userId, {
			page: 1,
			limit: 10,
		});

		expect(result.notifications.length).toBeGreaterThanOrEqual(2);
		expect(result.total).toBeGreaterThanOrEqual(2);
		expect(typeof result.unreadCount).toBe("number");
		expect(result.page).toBe(1);
		expect(result.limit).toBe(10);
	});

	it("filters by isRead when provided in query", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		await seedNotification(userId, { isRead: false });
		await seedNotification(userId, { isRead: true });

		const result = await NotificationService.getUserNotifications(userId, {
			isRead: false,
		});

		expect(result.notifications.length).toBeGreaterThanOrEqual(1);
		expect(result.notifications.every((n: any) => n.isRead === false)).toBe(true);
	});

	it("filters by type when provided in query", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		await seedNotification(userId, { type: "mention" });
		await seedNotification(userId, { type: "reply" });

		const result = await NotificationService.getUserNotifications(userId, {
			type: "mention",
		});

		expect(result.notifications.length).toBeGreaterThanOrEqual(1);
	});
});

// ===========================================================================
// getNotificationById — basic coverage
// ===========================================================================

describe("NotificationService.getNotificationById", () => {
	it("returns notification when found by id and userId", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const notification = await seedNotification(userId);
		const notificationId = (notification._id as Types.ObjectId).toString();

		const result = await NotificationService.getNotificationById(
			notificationId,
			userId,
		);

		expect(result).toBeDefined();
		expect((result as any)._id.toString()).toBe(notificationId);
	});

	it("throws 404 when notification not found or belongs to another user", async () => {
		const user = await createTestUser();
		const otherUser = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const otherUserId = (otherUser._id as Types.ObjectId).toString();

		const notification = await seedNotification(userId);
		const notificationId = (notification._id as Types.ObjectId).toString();

		await expect(
			NotificationService.getNotificationById(notificationId, otherUserId),
		).rejects.toMatchObject({
			statusCode: 404,
			message: "Notification not found",
		});
	});
});

// ===========================================================================
// deleteAllRead — basic coverage
// ===========================================================================

describe("NotificationService.deleteAllRead", () => {
	it("deletes all read notifications for a user", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		await seedNotification(userId, { isRead: true });
		await seedNotification(userId, { isRead: true });
		await seedNotification(userId, { isRead: false }); // should NOT be deleted

		const result = await NotificationService.deleteAllRead(userId);

		expect(result.deletedCount).toBe(2);
	});

	it("returns 0 when no read notifications exist", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();

		const result = await NotificationService.deleteAllRead(userId);

		expect(result.deletedCount).toBe(0);
	});
});

// ===========================================================================
// Helper notification creators — coverage for spec 08 invalidation chain
// ===========================================================================

describe("NotificationService helper creators", () => {
	it("createMentionNotification creates notification and invalidates cache", async () => {
		const mentioned = await createTestUser();
		const mentioner = await createTestUser();
		const mentionedId = (mentioned._id as Types.ObjectId).toString();
		const mentionerId = (mentioner._id as Types.ObjectId).toString();
		const fakePostId = new Types.ObjectId().toString();
		const fakeThreadId = new Types.ObjectId().toString();

		await NotificationService.createMentionNotification(
			mentionedId,
			mentionerId,
			fakePostId,
			fakeThreadId,
			"Test Thread",
		);

		expect(mockedCacheService.del).toHaveBeenCalledWith(
			`notifications:unread:${mentionedId}`,
		);
	});

	it("createReplyNotification creates notification and invalidates cache", async () => {
		const recipient = await createTestUser();
		const replier = await createTestUser();
		const recipientId = (recipient._id as Types.ObjectId).toString();
		const replierId = (replier._id as Types.ObjectId).toString();
		const fakePostId = new Types.ObjectId().toString();
		const fakeThreadId = new Types.ObjectId().toString();

		await NotificationService.createReplyNotification(
			recipientId,
			replierId,
			fakePostId,
			fakeThreadId,
			"Test Thread",
		);

		expect(mockedCacheService.del).toHaveBeenCalledWith(
			`notifications:unread:${recipientId}`,
		);
	});

	it("createPostCreatedNotification creates notification and invalidates cache", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const fakePostId = new Types.ObjectId().toString();
		const fakeThreadId = new Types.ObjectId().toString();

		await NotificationService.createPostCreatedNotification(
			userId,
			fakePostId,
			fakeThreadId,
			"My Thread",
		);

		expect(mockedCacheService.del).toHaveBeenCalledWith(
			`notifications:unread:${userId}`,
		);
	});

	it("createThreadCreatedNotification creates notification and invalidates cache", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const fakeThreadId = new Types.ObjectId().toString();

		await NotificationService.createThreadCreatedNotification(
			userId,
			fakeThreadId,
			"My New Thread",
		);

		expect(mockedCacheService.del).toHaveBeenCalledWith(
			`notifications:unread:${userId}`,
		);
	});

	it("createAIModerationRejectedNotification creates notification and invalidates cache", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const fakePostId = new Types.ObjectId().toString();
		const fakeThreadId = new Types.ObjectId().toString();

		await NotificationService.createAIModerationRejectedNotification(
			userId,
			fakePostId,
			fakeThreadId,
			"Test Thread",
			"spam detected",
		);

		expect(mockedCacheService.del).toHaveBeenCalledWith(
			`notifications:unread:${userId}`,
		);
	});

	it("createAIModerationFlaggedNotification creates notification and invalidates cache", async () => {
		const user = await createTestUser();
		const userId = (user._id as Types.ObjectId).toString();
		const fakePostId = new Types.ObjectId().toString();
		const fakeThreadId = new Types.ObjectId().toString();

		await NotificationService.createAIModerationFlaggedNotification(
			userId,
			fakePostId,
			fakeThreadId,
			"Test Thread",
			"potentially inappropriate",
		);

		expect(mockedCacheService.del).toHaveBeenCalledWith(
			`notifications:unread:${userId}`,
		);
	});
});
