import express from "express";
import { WebhookController } from "./webhook.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { emailStatusWebhookSchema } from "./webhook.validation";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";

const router = express.Router();

router.post(
	"/email-status",
	validateRequest(emailStatusWebhookSchema),
	WebhookController.handleEmailStatus,
);

router.get(
	"/logs",
	authenticate,
	authorize("Admin"),
	WebhookController.getWebhookLogs,
);

export const WebhookRoutes = router;
