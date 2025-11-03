import express from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateRequest } from "../../middleware/validateRequest";
import { AdminController } from "./admin.controller";
import {
  updateUserSchema,
  banUserSchema,
  createReportSchema,
  reportActionSchema,
  updateSystemSettingsSchema,
} from "./admin.validation";

const router = express.Router();

// ==================== Dashboard ====================
// GET /api/v1/admin/dashboard - Admin & Moderator only
router.get(
  "/dashboard",
  authenticate,
  authorize("Admin", "Moderator"),
  AdminController.getDashboardStats
);

// ==================== User Management ====================
// GET /api/v1/admin/users - Admin & Moderator only
router.get(
  "/users",
  authenticate,
  authorize("Admin", "Moderator"),
  AdminController.getAllUsers
);

// PATCH /api/v1/admin/users/:userId - Admin only
router.patch(
  "/users/:userId",
  authenticate,
  authorize("Admin"),
  validateRequest(updateUserSchema),
  AdminController.updateUser
);

// POST /api/v1/admin/users/:userId/ban - Admin & Moderator only
router.post(
  "/users/:userId/ban",
  authenticate,
  authorize("Admin", "Moderator"),
  validateRequest(banUserSchema),
  AdminController.banUser
);

// POST /api/v1/admin/users/:userId/unban - Admin & Moderator only
router.post(
  "/users/:userId/unban",
  authenticate,
  authorize("Admin", "Moderator"),
  AdminController.unbanUser
);

// ==================== Content Moderation ====================
// POST /api/v1/admin/reports - Any authenticated user can report
router.post(
  "/reports",
  authenticate,
  validateRequest(createReportSchema),
  AdminController.createReport
);

// GET /api/v1/admin/reports - Admin & Moderator only
router.get(
  "/reports",
  authenticate,
  authorize("Admin", "Moderator"),
  AdminController.getAllReports
);

// GET /api/v1/admin/reports/:reportId - Admin & Moderator only
router.get(
  "/reports/:reportId",
  authenticate,
  authorize("Admin", "Moderator"),
  AdminController.getReportById
);

// POST /api/v1/admin/reports/:reportId/action - Admin & Moderator only
router.post(
  "/reports/:reportId/action",
  authenticate,
  authorize("Admin", "Moderator"),
  validateRequest(reportActionSchema),
  AdminController.takeReportAction
);

// ==================== Activity Logs ====================
// GET /api/v1/admin/activity-logs - Admin only
router.get(
  "/activity-logs",
  authenticate,
  authorize("Admin"),
  AdminController.getActivityLogs
);

// ==================== System Settings ====================
// GET /api/v1/admin/settings - Admin only
router.get(
  "/settings",
  authenticate,
  authorize("Admin"),
  AdminController.getSystemSettings
);

// PATCH /api/v1/admin/settings - Admin only
router.patch(
  "/settings",
  authenticate,
  authorize("Admin"),
  validateRequest(updateSystemSettingsSchema),
  AdminController.updateSystemSettings
);

export const AdminRoutes = router;
