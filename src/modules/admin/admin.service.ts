import httpStatus from "http-status";
import { Types } from "mongoose";
import AppError from "../../errors/AppError";
import { Post } from "../post/post.model";
import { Thread } from "../thread/thread.model";
import { User } from "../user/user.model";
import type {
	IActivityLogCreate,
	IBanUser,
	IDashboardStats,
	IReportAction,
	IReportCreate,
	IReportFilter,
	ISystemSettings,
	IUserFilter,
	IUserUpdate,
} from "./admin.interface";
import { ActivityLog, Ban, Report, SystemSettings } from "./admin.model";

const getDashboardStats = async (): Promise<IDashboardStats> => {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const [
		totalUsers,
		totalThreads,
		totalPosts,
		totalReports,
		activeUsers,
		newUsersToday,
		newThreadsToday,
		newPostsToday,
		pendingReports,
		bannedUsers,
	] = await Promise.all([
		User.countDocuments(),
		Thread.countDocuments({ status: { $ne: "deleted" } }),
		Post.countDocuments({ status: "active" }),
		Report.countDocuments(),
		User.countDocuments({ isActive: true }),
		User.countDocuments({ createdAt: { $gte: today } }),
		Thread.countDocuments({ createdAt: { $gte: today } }),
		Post.countDocuments({ createdAt: { $gte: today } }),
		Report.countDocuments({ status: "pending" }),
		Ban.countDocuments({ isActive: true }),
	]);

	return {
		totalUsers,
		totalThreads,
		totalPosts,
		totalReports,
		activeUsers,
		newUsersToday,
		newThreadsToday,
		newPostsToday,
		pendingReports,
		bannedUsers,
	};
};

const getUserStats = async () => {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const lastWeek = new Date(today);
	lastWeek.setDate(lastWeek.getDate() - 7);

	const lastMonth = new Date(today);
	lastMonth.setMonth(lastMonth.getMonth() - 1);

	const [
		totalUsers,
		activeUsers,
		verifiedUsers,
		newToday,
		newThisWeek,
		newThisMonth,
		bannedUsers,
		usersByRole,
	] = await Promise.all([
		User.countDocuments(),
		User.countDocuments({ isActive: true }),
		User.countDocuments({ emailVerified: true }),
		User.countDocuments({ createdAt: { $gte: today } }),
		User.countDocuments({ createdAt: { $gte: lastWeek } }),
		User.countDocuments({ createdAt: { $gte: lastMonth } }),
		Ban.countDocuments({ isActive: true }),
		User.aggregate([
			{ $group: { _id: "$role", count: { $sum: 1 } } },
		]),
	]);

	return {
		total: totalUsers,
		active: activeUsers,
		verified: verifiedUsers,
		newToday,
		newThisWeek,
		newThisMonth,
		banned: bannedUsers,
		byRole: usersByRole.reduce((acc: any, item: any) => {
			acc[item._id] = item.count;
			return acc;
		}, {}),
	};
};

const getThreadStats = async () => {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const lastWeek = new Date(today);
	lastWeek.setDate(lastWeek.getDate() - 7);

	const lastMonth = new Date(today);
	lastMonth.setMonth(lastMonth.getMonth() - 1);

	const [
		totalThreads,
		activeThreads,
		pinnedThreads,
		lockedThreads,
		newToday,
		newThisWeek,
		newThisMonth,
		threadsByStatus,
	] = await Promise.all([
		Thread.countDocuments({ status: { $ne: "deleted" } }),
		Thread.countDocuments({ status: "active" }),
		Thread.countDocuments({ isPinned: true }),
		Thread.countDocuments({ isLocked: true }),
		Thread.countDocuments({ createdAt: { $gte: today } }),
		Thread.countDocuments({ createdAt: { $gte: lastWeek } }),
		Thread.countDocuments({ createdAt: { $gte: lastMonth } }),
		Thread.aggregate([
			{ $match: { status: { $ne: "deleted" } } },
			{ $group: { _id: "$status", count: { $sum: 1 } } },
		]),
	]);

	return {
		total: totalThreads,
		active: activeThreads,
		pinned: pinnedThreads,
		locked: lockedThreads,
		newToday,
		newThisWeek,
		newThisMonth,
		byStatus: threadsByStatus.reduce((acc: any, item: any) => {
			acc[item._id] = item.count;
			return acc;
		}, {}),
	};
};

const getPostStats = async () => {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const lastWeek = new Date(today);
	lastWeek.setDate(lastWeek.getDate() - 7);

	const lastMonth = new Date(today);
	lastMonth.setMonth(lastMonth.getMonth() - 1);

	const [
		totalPosts,
		activePosts,
		newToday,
		newThisWeek,
		newThisMonth,
		postsByModeration,
		flaggedPosts,
		deletedPosts,
	] = await Promise.all([
		Post.countDocuments(),
		Post.countDocuments({ status: "active" }),
		Post.countDocuments({ createdAt: { $gte: today } }),
		Post.countDocuments({ createdAt: { $gte: lastWeek } }),
		Post.countDocuments({ createdAt: { $gte: lastMonth } }),
		Post.aggregate([
			{ $group: { _id: "$moderationStatus", count: { $sum: 1 } } },
		]),
		Post.countDocuments({ moderationStatus: "flagged" }),
		Post.countDocuments({ status: "deleted" }),
	]);

	const moderationStats = postsByModeration.reduce((acc: any, item: any) => {
		acc[item._id] = item.count;
		return acc;
	}, {});

	return {
		total: totalPosts,
		active: activePosts,
		newToday,
		newThisWeek,
		newThisMonth,
		deleted: deletedPosts,
		moderation: {
			pending: moderationStats.pending || 0,
			approved: moderationStats.approved || 0,
			rejected: moderationStats.rejected || 0,
			flagged: flaggedPosts,
		},
	};
};

const getAllUsers = async (filters: IUserFilter) => {
	const {
		role,
		isActive,
		emailVerified,
		searchTerm,
		page = 1,
		limit = 20,
		sort = "-createdAt",
	} = filters;

	const query: any = {};

	if (role) query.role = role;
	if (isActive !== undefined) query.isActive = isActive;
	if (emailVerified !== undefined) query.emailVerified = emailVerified;
	if (searchTerm) {
		query.$or = [
			{ name: { $regex: searchTerm, $options: "i" } },
			{ email: { $regex: searchTerm, $options: "i" } },
		];
	}

	const skip = (page - 1) * limit;

	const [users, total] = await Promise.all([
		User.find(query)
			.select("-password -emailVerificationToken -passwordResetToken")
			.sort(sort)
			.skip(skip)
			.limit(limit)
			.lean(),
		User.countDocuments(query),
	]);

	return {
		users,
		total,
		page,
		limit,
		totalPages: Math.ceil(total / limit),
	};
};

const getAllPosts = async (filters: any) => {
	const {
		moderationStatus,
		status,
		searchTerm,
		page = 1,
		limit = 50,
		sort = "-createdAt",
	} = filters;

	const query: any = {};

	if (moderationStatus) query.moderationStatus = moderationStatus;
	if (status) query.status = status;
	if (searchTerm) {
		query.content = { $regex: searchTerm, $options: "i" };
	}

	const skip = (page - 1) * limit;

	const [posts, total] = await Promise.all([
		Post.find(query)
			.populate("author", "name email avatar")
			.populate("threadId", "title")
			.sort(sort)
			.skip(skip)
			.limit(limit)
			.lean(),
		Post.countDocuments(query),
	]);

	return {
		posts,
		total,
		page,
		limit,
		totalPages: Math.ceil(total / limit),
	};
};

const getAllThreads = async (filters: any) => {
	const {
		status,
		isPinned,
		isLocked,
		searchTerm,
		page = 1,
		limit = 50,
		sort = "-createdAt",
	} = filters;

	const query: any = {};

	if (status) query.status = status;
	if (isPinned !== undefined) query.isPinned = isPinned;
	if (isLocked !== undefined) query.isLocked = isLocked;
	if (searchTerm) {
		query.$or = [
			{ title: { $regex: searchTerm, $options: "i" } },
			{ content: { $regex: searchTerm, $options: "i" } },
		];
	}

	const skip = (page - 1) * limit;

	const [threads, total] = await Promise.all([
		Thread.find(query)
			.populate("createdBy", "name email avatar")
			.sort(sort)
			.skip(skip)
			.limit(limit)
			.lean(),
		Thread.countDocuments(query),
	]);

	return {
		threads,
		total,
		page,
		limit,
		totalPages: Math.ceil(total / limit),
	};
};

const updateUser = async (
	userId: string,
	updateData: IUserUpdate,
	adminId: string,
): Promise<any> => {
	const user = await User.findById(userId);

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	Object.assign(user, updateData);
	await user.save();

	// Log activity
	await logActivity({
		adminId: new Types.ObjectId(adminId),
		action: "user_role_changed",
		targetType: "user",
		targetId: new Types.ObjectId(userId),
		details: {
			oldRole: user.role,
			newRole: updateData.role,
			changes: updateData,
		},
	});

	return user;
};

// Ban user
const banUser = async (userId: string, banData: IBanUser): Promise<any> => {
	const user = await User.findById(userId);

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (!user.isActive) {
		throw new AppError(httpStatus.BAD_REQUEST, "User is already banned");
	}

	// Check if already banned
	const existingBan = await Ban.findOne({ userId, isActive: true });
	if (existingBan) {
		throw new AppError(httpStatus.BAD_REQUEST, "User is already banned");
	}

	// Deactivate user
	user.isActive = false;
	await user.save();

	const expiresAt = banData.duration
		? new Date(Date.now() + banData.duration * 24 * 60 * 60 * 1000)
		: undefined;

	const ban = await Ban.create({
		userId,
		reason: banData.reason,
		bannedBy: banData.bannedBy,
		expiresAt,
		isActive: true,
	});

	// Log activity
	await logActivity({
		adminId: banData.bannedBy,
		action: "user_banned",
		targetType: "user",
		targetId: new Types.ObjectId(userId),
		details: {
			reason: banData.reason,
			duration: banData.duration,
			expiresAt,
		},
	});

	return ban;
};

// Unban user
const unbanUser = async (userId: string, adminId: string): Promise<any> => {
	const user = await User.findById(userId);

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	// Find active ban
	const ban = await Ban.findOne({ userId, isActive: true });
	if (!ban) {
		throw new AppError(httpStatus.BAD_REQUEST, "User is not banned");
	}

	// Activate user
	user.isActive = true;
	await user.save();

	// Deactivate ban
	ban.isActive = false;
	await ban.save();

	// Log activity
	await logActivity({
		adminId: new Types.ObjectId(adminId),
		action: "user_unbanned",
		targetType: "user",
		targetId: new Types.ObjectId(userId),
		details: {
			originalBanReason: ban.reason,
		},
	});

	return user;
};

const createReport = async (reportData: IReportCreate): Promise<any> => {
	// Validate reported content exists
	let contentExists = false;

	switch (reportData.reportedContentType) {
		case "thread":
			contentExists = !!(await Thread.findById(reportData.reportedContentId));
			break;
		case "post":
			contentExists = !!(await Post.findById(reportData.reportedContentId));
			break;
		case "user":
			contentExists = !!(await User.findById(reportData.reportedContentId));
			break;
	}

	if (!contentExists) {
		throw new AppError(httpStatus.NOT_FOUND, "Reported content not found");
	}

	// Check for duplicate reports
	const existingReport = await Report.findOne({
		reportedContentType: reportData.reportedContentType,
		reportedContentId: reportData.reportedContentId,
		reportedBy: reportData.reportedBy,
		status: { $in: ["pending", "reviewing"] },
	});

	if (existingReport) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"You have already reported this content",
		);
	}

	const report = await Report.create(reportData);

	return report;
};

const getAllReports = async (filters: IReportFilter) => {
	const {
		status,
		reportType,
		reportedContentType,
		page = 1,
		limit = 20,
	} = filters;

	const query: any = {};

	if (status) query.status = status;
	if (reportType) query.reportType = reportType;
	if (reportedContentType) query.reportedContentType = reportedContentType;

	const skip = (page - 1) * limit;

	const [reports, total] = await Promise.all([
		Report.find(query)
			.populate("reportedBy", "name email avatar")
			.populate("reviewedBy", "name email")
			.sort("-createdAt")
			.skip(skip)
			.limit(limit)
			.lean(),
		Report.countDocuments(query),
	]);

	return {
		reports,
		total,
		page,
		limit,
		totalPages: Math.ceil(total / limit),
	};
};

const getReportById = async (reportId: string): Promise<any> => {
	const report = await Report.findById(reportId)
		.populate("reportedBy", "name email avatar")
		.populate("reviewedBy", "name email");

	if (!report) {
		throw new AppError(httpStatus.NOT_FOUND, "Report not found");
	}

	// Populate reported content
	let reportedContent = null;

	switch (report.reportedContentType) {
		case "thread":
			reportedContent = await Thread.findById(
				report.reportedContentId,
			).populate("createdBy", "name email avatar");
			break;
		case "post":
			reportedContent = await Post.findById(report.reportedContentId).populate(
				"author",
				"name email avatar",
			);
			break;
		case "user":
			reportedContent = await User.findById(report.reportedContentId).select(
				"-password -emailVerificationToken -passwordResetToken",
			);
			break;
	}

	return {
		...report.toObject(),
		reportedContent,
	};
};

// Take action on report
const takeReportAction = async (actionData: IReportAction): Promise<any> => {
	const { reportId, action, resolution, reviewNote, reviewedBy } = actionData;

	const report = await Report.findById(reportId);

	if (!report) {
		throw new AppError(httpStatus.NOT_FOUND, "Report not found");
	}

	if (report.status === "resolved" || report.status === "dismissed") {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Report has already been processed",
		);
	}

	report.status = action === "resolve" ? "resolved" : "dismissed";
	report.reviewedBy = new Types.ObjectId(reviewedBy);
	report.reviewNote = reviewNote;
	report.resolvedAt = new Date();

	if (action === "resolve" && resolution) {
		report.resolution = resolution;

		// Take action based on resolution
		switch (resolution) {
			case "content_removed":
				await removeContent(
					report.reportedContentType,
					report.reportedContentId.toString(),
				);
				break;
			case "user_banned":
				await banUser(report.reportedContentId.toString(), {
					reason: `Banned due to report: ${report.reportType}`,
					bannedBy: new Types.ObjectId(reviewedBy),
				});
				break;
			// user_warned and no_action don't require automatic actions
		}
	}

	await report.save();

	// Log activity
	await logActivity({
		adminId: new Types.ObjectId(reviewedBy),
		action: "report_resolved",
		targetType: "report",
		targetId: new Types.ObjectId(reportId),
		details: {
			reportType: report.reportType,
			action,
			resolution,
		},
	});

	return report;
};

// Helper: Remove content
const removeContent = async (
	contentType: string,
	contentId: string,
): Promise<void> => {
	switch (contentType) {
		case "thread":
			await Thread.findByIdAndUpdate(contentId, { status: "deleted" });
			break;
		case "post":
			await Post.findByIdAndUpdate(contentId, { status: "deleted" });
			break;
	}
};

// Log admin activity
const logActivity = async (logData: IActivityLogCreate): Promise<void> => {
	await ActivityLog.create(logData);
};

const getActivityLogs = async (adminId?: string, page = 1, limit = 50) => {
	const query: any = {};
	if (adminId) query.adminId = adminId;

	const skip = (page - 1) * limit;

	const [logs, total] = await Promise.all([
		ActivityLog.find(query)
			.populate("adminId", "name email role")
			.sort("-createdAt")
			.skip(skip)
			.limit(limit)
			.lean(),
		ActivityLog.countDocuments(query),
	]);

	return {
		logs,
		total,
		page,
		limit,
		totalPages: Math.ceil(total / limit),
	};
};

const getSystemSettings = async (): Promise<any> => {
	let settings = await SystemSettings.findOne().populate(
		"updatedBy",
		"name email",
	);

	if (!settings) {
		settings = await SystemSettings.create({
			updatedBy: new Types.ObjectId("000000000000000000000000"), // Placeholder
		});
	}

	return settings;
};

const updateSystemSettings = async (
	updates: Partial<ISystemSettings>,
	adminId: string,
): Promise<any> => {
	let settings = await SystemSettings.findOne();

	if (!settings) {
		settings = await SystemSettings.create({
			...updates,
			updatedBy: new Types.ObjectId(adminId),
		});
	} else {
		Object.assign(settings, updates);
		settings.updatedBy = new Types.ObjectId(adminId);
		await settings.save();
	}

	// Log activity
	await logActivity({
		adminId: new Types.ObjectId(adminId),
		action: "settings_updated",
		details: updates,
	});

	return settings;
};

export const AdminService = {
	// Dashboard
	getDashboardStats,
	getUserStats,
	getThreadStats,
	getPostStats,

	// User Management
	getAllUsers,
	updateUser,
	banUser,
	unbanUser,

	// Content Management
	getAllPosts,
	getAllThreads,

	// Content Moderation
	createReport,
	getAllReports,
	getReportById,
	takeReportAction,

	// Activity Logs
	getActivityLogs,

	// System Settings
	getSystemSettings,
	updateSystemSettings,
};
