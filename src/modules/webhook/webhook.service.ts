import crypto from "node:crypto";
import type {
	IEmailStatusWebhook,
	IWebhookLog,
} from "./webhook.interface";
import { WebhookLog } from "./webhook.model";
import logger from "../../utils/logger";
import env from "../../config/env";
import { queueService } from "../../services/queue.service";

class WebhookService {
	async verifySignature(
		payload: string,
		signature: string,
		timestamp: string,
	): Promise<boolean> {
		const secret = env.WEBHOOK_SECRET || "default-webhook-secret";
		const signedPayload = `${timestamp}.${payload}`;
		const expectedSignature = crypto
			.createHmac("sha256", secret)
			.update(signedPayload)
			.digest("hex");

		return crypto.timingSafeEqual(
			Buffer.from(signature),
			Buffer.from(expectedSignature),
		);
	}

	async processEmailStatus(
		data: IEmailStatusWebhook,
	): Promise<{ success: boolean; messageId: string }> {
		try {
			await this.logWebhook({
				event: `email.${data.event}`,
				payload: data as unknown as Record<string, unknown>,
				source: "email",
				status: "success",
				timestamp: new Date(),
			});

			logger.info({
				event: `email.${data.event}`,
				messageId: data.messageId,
				recipient: data.recipient,
				msg: `Email status webhook received: ${data.event}`,
			});

			await queueService.publishToQueue("webhooks", {
				type: "email-status",
				data,
				timestamp: new Date().toISOString(),
			});

			return {
				success: true,
				messageId: data.messageId,
			};
		} catch (error) {
			logger.error({
				error,
				messageId: data.messageId,
				msg: "Failed to process email status webhook",
			});

			await this.logWebhook({
				event: `email.${data.event}`,
				payload: data as unknown as Record<string, unknown>,
				source: "email",
				status: "failed",
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: new Date(),
			});

			throw error;
		}
	}

	async logWebhook(data: IWebhookLog): Promise<void> {
		try {
			await WebhookLog.create(data);
		} catch (error) {
			logger.error({
				error,
				msg: "Failed to log webhook event",
			});
		}
	}

	async getWebhookLogs(filters: {
		event?: string;
		source?: string;
		status?: string;
		limit?: number;
	}): Promise<IWebhookLog[]> {
		const query: Record<string, unknown> = {};

		if (filters.event) query.event = filters.event;
		if (filters.source) query.source = filters.source;
		if (filters.status) query.status = filters.status;

		return WebhookLog.find(query)
			.sort({ timestamp: -1 })
			.limit(filters.limit || 100)
			.lean();
	}
}

export const webhookService = new WebhookService();
