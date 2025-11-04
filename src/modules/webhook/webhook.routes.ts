import express from "express";
import { WebhookController } from "./webhook.controller";
import { validateRequest } from "../../middleware/validateRequest";
import {
	emailStatusWebhookSchema,
	notificationWebhookSchema,
	createExternalWebhookSchema,
	updateExternalWebhookSchema,
} from "./webhook.validation";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";

const router = express.Router();

// Incoming webhook endpoints (from external services)
router.post(
	"/email-status",
	validateRequest(emailStatusWebhookSchema),
	WebhookController.handleEmailStatus,
);

router.post(
	"/notification",
	validateRequest(notificationWebhookSchema),
	WebhookController.handleNotificationWebhook,
);

// Webhook logs (Admin only)
router.get(
	"/logs",
	authenticate,
	authorize("Admin"),
	WebhookController.getWebhookLogs,
);

// External webhook management (Admin only)
router.post(
	"/external",
	authenticate,
	authorize("Admin"),
	validateRequest(createExternalWebhookSchema),
	WebhookController.createExternalWebhook,
);

router.get(
	"/external",
	authenticate,
	authorize("Admin"),
	WebhookController.getExternalWebhooks,
);

router.put(
	"/external/:id",
	authenticate,
	authorize("Admin"),
	validateRequest(updateExternalWebhookSchema),
	WebhookController.updateExternalWebhook,
);

router.delete(
	"/external/:id",
	authenticate,
	authorize("Admin"),
	WebhookController.deleteExternalWebhook,
);

export const WebhookRoutes = router;
