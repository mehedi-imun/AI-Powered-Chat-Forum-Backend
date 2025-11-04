import httpStatus from "http-status";
import { Types } from "mongoose";
import { getIO } from "../../config/socket";
import AppError from "../../errors/AppError";
import type {
	INotification,
	INotificationCreate,
	INotificationQuery,
	INotificationWithRelations,
} from "./notification.interface";
import { Notification } from "./notification.model";

const createNotification = async (
	data: INotificationCreate,
): Promise<INotification> => {
	const notification = await Notification.create({
		userId: new Types.ObjectId(data.userId),
		type: data.type,
		title: data.title,
		message: data.message,
		link: data.link,
		relatedUserId: data.relatedUserId
			? new Types.ObjectId(data.relatedUserId)
			: undefined,
		relatedThreadId: data.relatedThreadId
			? new Types.ObjectId(data.relatedThreadId)
			: undefined,
		relatedPostId: data.relatedPostId
			? new Types.ObjectId(data.relatedPostId)
			: undefined,
		isRead: false,
	});

	// Emit Socket.IO event to user's personal room
	const io = getIO();
	if (io) {
		const populatedNotification = await Notification.findById(notification._id)
			.populate("relatedUserId", "name email avatar")
			.populate("relatedThreadId", "title slug")
			.populate("relatedPostId", "content");

		io.to(`user:${data.userId}`).emit("notification:new", {
			notification: populatedNotification,
			timestamp: new Date(),
		});
	}

	return notification;
};

const getUserNotifications = async (
	userId: string,
	query: INotificationQuery,
): Promise<{
	notifications: INotificationWithRelations[];
	total: number;
	unreadCount: number;
}> => {
	const page = Number(query.page) || 1;
	const limit = Number(query.limit) || 20;
	const skip = (page - 1) * limit;

	// Build filter
	const filter: any = { userId: new Types.ObjectId(userId) };

	if (query.isRead !== undefined) {
		filter.isRead = query.isRead;
	}

	if (query.type) {
		filter.type = query.type;
	}

	const notifications = await Notification.find(filter)
		.populate("relatedUserId", "name email avatar")
		.populate("relatedThreadId", "title slug")
		.populate("relatedPostId", "content")
		.sort({ createdAt: -1 })
		.skip(skip)
		.limit(limit);

	const total = await Notification.countDocuments(filter);
	const unreadCount = await Notification.countDocuments({
		userId: new Types.ObjectId(userId),
		isRead: false,
	});

	return {
		notifications: notifications as INotificationWithRelations[],
		total,
		unreadCount,
	};
};

const getNotificationById = async (
	id: string,
	userId: string,
): Promise<INotificationWithRelations> => {
	const notification = await Notification.findOne({
		_id: id,
		userId: new Types.ObjectId(userId),
	})
		.populate("relatedUserId", "name email avatar")
		.populate("relatedThreadId", "title slug")
		.populate("relatedPostId", "content");

	if (!notification) {
		throw new AppError(httpStatus.NOT_FOUND, "Notification not found");
	}

	return notification as INotificationWithRelations;
};

// Mark notification as read
const markAsRead = async (
	id: string,
	userId: string,
): Promise<INotification> => {
	const notification = await Notification.findOne({
		_id: id,
		userId: new Types.ObjectId(userId),
	});

	if (!notification) {
		throw new AppError(httpStatus.NOT_FOUND, "Notification not found");
	}

	if (!notification.isRead) {
		notification.isRead = true;
		notification.readAt = new Date();
		await notification.save();

		// Emit Socket.IO event
		const io = getIO();
		if (io) {
			const unreadCount = await Notification.countDocuments({
				userId: new Types.ObjectId(userId),
				isRead: false,
			});

			io.to(`user:${userId}`).emit("notification:read", {
				notificationId: id,
				unreadCount,
				timestamp: new Date(),
			});
		}
	}

	return notification;
};

// Mark all notifications as read
const markAllAsRead = async (
	userId: string,
): Promise<{ modifiedCount: number }> => {
	const result = await Notification.updateMany(
		{
			userId: new Types.ObjectId(userId),
			isRead: false,
		},
		{
			isRead: true,
			readAt: new Date(),
		},
	);

	// Emit Socket.IO event
	const io = getIO();
	if (io) {
		io.to(`user:${userId}`).emit("notification:all_read", {
			timestamp: new Date(),
		});
	}

	return { modifiedCount: result.modifiedCount };
};

const deleteNotification = async (
	id: string,
	userId: string,
): Promise<void> => {
	const notification = await Notification.findOne({
		_id: id,
		userId: new Types.ObjectId(userId),
	});

	if (!notification) {
		throw new AppError(httpStatus.NOT_FOUND, "Notification not found");
	}

	await Notification.findByIdAndDelete(id);

	// Emit Socket.IO event
	const io = getIO();
	if (io) {
		const unreadCount = await Notification.countDocuments({
			userId: new Types.ObjectId(userId),
			isRead: false,
		});

		io.to(`user:${userId}`).emit("notification:deleted", {
			notificationId: id,
			unreadCount,
			timestamp: new Date(),
		});
	}
};

const deleteAllRead = async (
	userId: string,
): Promise<{ deletedCount: number }> => {
	const result = await Notification.deleteMany({
		userId: new Types.ObjectId(userId),
		isRead: true,
	});

	return { deletedCount: result.deletedCount };
};

const getUnreadCount = async (userId: string): Promise<number> => {
	return await Notification.countDocuments({
		userId: new Types.ObjectId(userId),
		isRead: false,
	});
};

// Helper: Create mention notification
const createMentionNotification = async (
	mentionedUserId: string,
	mentionedBy: string,
	postId: string,
	threadId: string,
	threadTitle: string,
): Promise<void> => {
	await createNotification({
		userId: mentionedUserId,
		type: "mention",
		title: "You were mentioned",
		message: `Someone mentioned you in "${threadTitle}"`,
		link: `/threads/${threadId}#post-${postId}`,
		relatedUserId: mentionedBy,
		relatedThreadId: threadId,
		relatedPostId: postId,
	});
};

// Helper: Create reply notification
const createReplyNotification = async (
	recipientUserId: string,
	repliedBy: string,
	postId: string,
	threadId: string,
	threadTitle: string,
): Promise<void> => {
	await createNotification({
		userId: recipientUserId,
		type: "reply",
		title: "New reply to your post",
		message: `Someone replied to your post in "${threadTitle}"`,
		link: `/threads/${threadId}#post-${postId}`,
		relatedUserId: repliedBy,
		relatedThreadId: threadId,
		relatedPostId: postId,
	});
};

// Helper: Create post created notification
const createPostCreatedNotification = async (
	userId: string,
	postId: string,
	threadId: string,
	threadTitle: string,
): Promise<void> => {
	await createNotification({
		userId,
		type: "post_created",
		title: "Your post has been published",
		message: `Your post in "${threadTitle}" is now live and being reviewed by our AI moderator`,
		link: `/threads/${threadId}#post-${postId}`,
		relatedThreadId: threadId,
		relatedPostId: postId,
	});
};

// Helper: Create thread created notification
const createThreadCreatedNotification = async (
	userId: string,
	threadId: string,
	threadTitle: string,
): Promise<void> => {
	console.log(
		`📢 Creating thread_created notification for user: ${userId}, thread: ${threadId}`,
	);
	const notification = await createNotification({
		userId,
		type: "thread_created",
		title: "Your thread has been created",
		message: `Your thread "${threadTitle}" is now live`,
		link: `/threads/${threadId}`,
		relatedThreadId: threadId,
	});
	console.log(
		`✅ Thread notification created with ID: ${notification._id}`,
	);
};

// Helper: Create AI moderation rejected notification
const createAIModerationRejectedNotification = async (
	userId: string,
	postId: string,
	threadId: string,
	threadTitle: string,
	reason: string,
): Promise<void> => {
	await createNotification({
		userId,
		type: "ai_moderation_rejected",
		title: "Your post was rejected",
		message: `Your post in "${threadTitle}" was removed by our AI moderator. Reason: ${reason}`,
		link: `/threads/${threadId}`,
		relatedThreadId: threadId,
		relatedPostId: postId,
	});
};

// Helper: Create AI moderation flagged notification
const createAIModerationFlaggedNotification = async (
	userId: string,
	postId: string,
	threadId: string,
	threadTitle: string,
	reason: string,
): Promise<void> => {
	await createNotification({
		userId,
		type: "ai_moderation_flagged",
		title: "Your post is under review",
		message: `Your post in "${threadTitle}" has been flagged for manual review. Reason: ${reason}`,
		link: `/threads/${threadId}#post-${postId}`,
		relatedThreadId: threadId,
		relatedPostId: postId,
	});
};

export const NotificationService = {
	createNotification,
	getUserNotifications,
	getNotificationById,
	markAsRead,
	markAllAsRead,
	deleteNotification,
	deleteAllRead,
	getUnreadCount,
	createMentionNotification,
	createReplyNotification,
	createPostCreatedNotification,
	createThreadCreatedNotification,
	createAIModerationRejectedNotification,
	createAIModerationFlaggedNotification,
};
