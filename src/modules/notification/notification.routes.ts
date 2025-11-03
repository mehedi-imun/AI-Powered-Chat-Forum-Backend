import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { NotificationController } from "./notification.controller";

const router = Router();

router.use(authenticate);

router.get("/", NotificationController.getUserNotifications);
router.get("/unread-count", NotificationController.getUnreadCount);
router.get("/:id", NotificationController.getNotificationById);
router.patch("/:id/read", NotificationController.markAsRead);
router.patch("/mark-all-read", NotificationController.markAllAsRead);
router.delete("/:id", NotificationController.deleteNotification);
router.delete("/read/all", NotificationController.deleteAllRead);

export const NotificationRoutes = router;
