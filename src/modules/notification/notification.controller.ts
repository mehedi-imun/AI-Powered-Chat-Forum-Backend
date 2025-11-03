import type { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { NotificationService } from "./notification.service";

const getUserNotifications = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId;
	const query = req.query;

	const result = await NotificationService.getUserNotifications(userId, query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Notifications retrieved successfully",
		data: result,
	});
});

const getNotificationById = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId;
	const { id } = req.params;

	const result = await NotificationService.getNotificationById(id, userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Notification retrieved successfully",
		data: result,
	});
});

// Mark notification as read
const markAsRead = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId;
	const { id } = req.params;

	const result = await NotificationService.markAsRead(id, userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Notification marked as read",
		data: result,
	});
});

// Mark all notifications as read
const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId;

	const result = await NotificationService.markAllAsRead(userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "All notifications marked as read",
		data: result,
	});
});

const deleteNotification = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId;
	const { id } = req.params;

	await NotificationService.deleteNotification(id, userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Notification deleted successfully",
		data: null,
	});
});

const deleteAllRead = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId;

	const result = await NotificationService.deleteAllRead(userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "All read notifications deleted",
		data: result,
	});
});

const getUnreadCount = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId;

	const count = await NotificationService.getUnreadCount(userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Unread count retrieved successfully",
		data: { unreadCount: count },
	});
});

export const NotificationController = {
	getUserNotifications,
	getNotificationById,
	markAsRead,
	markAllAsRead,
	deleteNotification,
	deleteAllRead,
	getUnreadCount,
};
