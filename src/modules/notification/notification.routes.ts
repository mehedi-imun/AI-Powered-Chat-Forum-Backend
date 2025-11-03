import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { NotificationController } from "./notification.controller";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get user notifications (with pagination and filters)
router.get("/", NotificationController.getUserNotifications);

// Get unread count
router.get("/unread-count", NotificationController.getUnreadCount);

// Get single notification
router.get("/:id", NotificationController.getNotificationById);

// Mark notification as read
router.patch("/:id/read", NotificationController.markAsRead);

// Mark all notifications as read
router.patch("/mark-all-read", NotificationController.markAllAsRead);

// Delete notification
router.delete("/:id", NotificationController.deleteNotification);

// Delete all read notifications
router.delete("/read/all", NotificationController.deleteAllRead);

export const NotificationRoutes = router;
