import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { AdminService } from "./admin.service";

const getDashboardStats = catchAsync(async (_req, res) => {
	const stats = await AdminService.getDashboardStats();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Dashboard statistics retrieved successfully",
		data: stats,
	});
});

const getUserStats = catchAsync(async (_req, res) => {
	const stats = await AdminService.getUserStats();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User statistics retrieved successfully",
		data: stats,
	});
});

const getThreadStats = catchAsync(async (_req, res) => {
	const stats = await AdminService.getThreadStats();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Thread statistics retrieved successfully",
		data: stats,
	});
});

const getPostStats = catchAsync(async (_req, res) => {
	const stats = await AdminService.getPostStats();
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Post statistics retrieved successfully",
		data: stats,
	});
});

const getAIModerationSummary = catchAsync(async (_req, res) => {
	const summary = await AdminService.getAIModerationSummary();
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "AI moderation summary retrieved successfully",
		data: summary,
	});
});

const getAllUsers = catchAsync(async (req, res) => {
	const result = await AdminService.getAllUsers(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Users retrieved successfully",
		data: result,
	});
});

const getAllPosts = catchAsync(async (req, res) => {
	const result = await AdminService.getAllPosts(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Posts retrieved successfully",
		data: result,
	});
});

const getAllThreads = catchAsync(async (req, res) => {
	const result = await AdminService.getAllThreads(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Threads retrieved successfully",
		data: result,
	});
});

const updateUser = catchAsync(async (req, res) => {
	const { userId } = req.params;
	const adminId = req.user?.userId;

	const user = await AdminService.updateUser(userId, req.body, adminId!);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User updated successfully",
		data: user,
	});
});

const banUser = catchAsync(async (req, res) => {
	const { userId } = req.params;
	const adminId = req.user?.userId;

	const ban = await AdminService.banUser(userId, {
		...req.body,
		bannedBy: adminId,
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User banned successfully",
		data: ban,
	});
});

const unbanUser = catchAsync(async (req, res) => {
	const { userId } = req.params;
	const adminId = req.user?.userId;

	const user = await AdminService.unbanUser(userId, adminId!);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User unbanned successfully",
		data: user,
	});
});

const createReport = catchAsync(async (req, res) => {
	const userId = req.user?.userId;
	const { Types } = require("mongoose");

	const report = await AdminService.createReport({
		...req.body,
		reportedBy: new Types.ObjectId(userId),
	});

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Report submitted successfully",
		data: report,
	});
});

const getAllReports = catchAsync(async (req, res) => {
	const result = await AdminService.getAllReports(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Reports retrieved successfully",
		data: result,
	});
});

const getReportById = catchAsync(async (req, res) => {
	const { reportId } = req.params;

	const report = await AdminService.getReportById(reportId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Report retrieved successfully",
		data: report,
	});
});

const takeReportAction = catchAsync(async (req, res) => {
	const { reportId } = req.params;
	const adminId = req.user?.userId;

	const report = await AdminService.takeReportAction({
		reportId,
		...req.body,
		reviewedBy: adminId!,
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Report action completed successfully",
		data: report,
	});
});

const getActivityLogs = catchAsync(async (req, res) => {
	const { adminId, page, limit } = req.query;

	const result = await AdminService.getActivityLogs(
		adminId as string,
		Number(page) || 1,
		Number(limit) || 50,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Activity logs retrieved successfully",
		data: result,
	});
});

const getSystemSettings = catchAsync(async (_req, res) => {
	const settings = await AdminService.getSystemSettings();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "System settings retrieved successfully",
		data: settings,
	});
});

const updateSystemSettings = catchAsync(async (req, res) => {
	const adminId = req.user?.userId;

	const settings = await AdminService.updateSystemSettings(req.body, adminId!);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "System settings updated successfully",
		data: settings,
	});
});

export const AdminController = {
	getDashboardStats,
	getUserStats,
	getThreadStats,
	getPostStats,
	getAIModerationSummary,
	getAllUsers,
	getAllPosts,
	getAllThreads,
	updateUser,
	banUser,
	unbanUser,
	createReport,
	getAllReports,
	getReportById,
	takeReportAction,
	getActivityLogs,
	getSystemSettings,
	updateSystemSettings,
};
