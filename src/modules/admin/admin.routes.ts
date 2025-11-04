import express from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateRequest } from "../../middleware/validateRequest";
import { AdminController } from "./admin.controller";
import {
	banUserSchema,
	createReportSchema,
	reportActionSchema,
	updateSystemSettingsSchema,
	updateUserSchema,
} from "./admin.validation";

const router = express.Router();

router.get(
	"/dashboard",
	authenticate,
	authorize("Admin", "Moderator"),
	AdminController.getDashboardStats,
);

router.get(
	"/users/stats",
	authenticate,
	authorize("Admin", "Moderator"),
	AdminController.getUserStats,
);

router.get(
	"/threads/stats",
	authenticate,
	authorize("Admin", "Moderator"),
	AdminController.getThreadStats,
);

router.get(
	"/posts/stats",
	authenticate,
	authorize("Admin", "Moderator"),
	AdminController.getPostStats,
);

router.get(
	"/users",
	authenticate,
	authorize("Admin", "Moderator"),
	AdminController.getAllUsers,
);

router.patch(
	"/users/:userId",
	authenticate,
	authorize("Admin"),
	validateRequest(updateUserSchema),
	AdminController.updateUser,
);

router.get(
	"/posts",
	authenticate,
	authorize("Admin", "Moderator"),
	AdminController.getAllPosts,
);

router.get(
	"/threads",
	authenticate,
	authorize("Admin", "Moderator"),
	AdminController.getAllThreads,
);

router.post(
	"/users/:userId/ban",
	authenticate,
	authorize("Admin", "Moderator"),
	validateRequest(banUserSchema),
	AdminController.banUser,
);

router.post(
	"/users/:userId/unban",
	authenticate,
	authorize("Admin", "Moderator"),
	AdminController.unbanUser,
);

router.post(
	"/reports",
	authenticate,
	validateRequest(createReportSchema),
	AdminController.createReport,
);

router.get(
	"/reports",
	authenticate,
	authorize("Admin", "Moderator"),
	AdminController.getAllReports,
);

router.get(
	"/reports/:reportId",
	authenticate,
	authorize("Admin", "Moderator"),
	AdminController.getReportById,
);

router.post(
	"/reports/:reportId/action",
	authenticate,
	authorize("Admin", "Moderator"),
	validateRequest(reportActionSchema),
	AdminController.takeReportAction,
);

router.get(
	"/activity-logs",
	authenticate,
	authorize("Admin"),
	AdminController.getActivityLogs,
);

router.get(
	"/settings",
	authenticate,
	authorize("Admin"),
	AdminController.getSystemSettings,
);

router.patch(
	"/settings",
	authenticate,
	authorize("Admin"),
	validateRequest(updateSystemSettingsSchema),
	AdminController.updateSystemSettings,
);

export const AdminRoutes = router;
