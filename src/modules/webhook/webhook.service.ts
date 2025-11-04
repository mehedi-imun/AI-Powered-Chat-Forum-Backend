import crypto from "node:crypto";
import axios from "axios";
import type {
	IEmailStatusWebhook,
	IWebhookLog,
	INotificationWebhook,
	IExternalWebhook,
} from "./webhook.interface";
import { WebhookLog, ExternalWebhook } from "./webhook.model";
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

	async processNotificationWebhook(
		data: INotificationWebhook,
	): Promise<{ success: boolean; notificationId: string }> {
		try {
			await this.logWebhook({
				event: data.event,
				payload: data as unknown as Record<string, unknown>,
				source: "notification",
				status: "success",
				timestamp: new Date(),
			});

			logger.info({
				event: data.event,
				notificationId: data.notificationId,
				userId: data.userId,
				msg: `Notification webhook received: ${data.event}`,
			});

			// Trigger external webhooks
			await this.triggerExternalWebhooks(data.event, data as unknown as Record<string, unknown>);

			return {
				success: true,
				notificationId: data.notificationId,
			};
		} catch (error) {
			logger.error({
				error,
				notificationId: data.notificationId,
				msg: "Failed to process notification webhook",
			});

			await this.logWebhook({
				event: data.event,
				payload: data as unknown as Record<string, unknown>,
				source: "notification",
				status: "failed",
				error: error instanceof Error ? error.message : "Unknown error",
				timestamp: new Date(),
			});

			throw error;
		}
	}

	async triggerExternalWebhooks(
		event: string,
		data: Record<string, unknown>,
	): Promise<void> {
		try {
			const webhooks = await ExternalWebhook.find({
				isActive: true,
				events: event,
			});

			if (webhooks.length === 0) {
				logger.debug({ event, msg: "No external webhooks configured for event" });
				return;
			}

			const promises = webhooks.map(async (webhook) => {
				try {
					const signature = webhook.secret
						? crypto
								.createHmac("sha256", webhook.secret)
								.update(JSON.stringify(data))
								.digest("hex")
						: undefined;

					const headers: Record<string, string> = {
						"Content-Type": "application/json",
						...(webhook.headers || {}),
						...(signature ? { "X-Webhook-Signature": signature } : {}),
						"X-Webhook-Event": event,
						"X-Webhook-Timestamp": new Date().toISOString(),
					};

					const response = await axios({
						method: webhook.method,
						url: webhook.url,
						data,
						headers,
						timeout: 10000,
					});

					logger.info({
						webhookUrl: webhook.url,
						event,
						status: response.status,
						msg: "External webhook triggered successfully",
					});

					await this.logWebhook({
						event: `external.${event}`,
						payload: {
							url: webhook.url,
							response: response.data,
						},
						source: "external",
						status: "success",
						timestamp: new Date(),
					});
				} catch (error) {
					logger.error({
						error,
						webhookUrl: webhook.url,
						event,
						msg: "Failed to trigger external webhook",
					});

					await this.logWebhook({
						event: `external.${event}`,
						payload: {
							url: webhook.url,
							error: error instanceof Error ? error.message : "Unknown error",
						},
						source: "external",
						status: "failed",
						error: error instanceof Error ? error.message : "Unknown error",
						timestamp: new Date(),
					});
				}
			});

			await Promise.allSettled(promises);
		} catch (error) {
			logger.error({
				error,
				event,
				msg: "Failed to trigger external webhooks",
			});
		}
	}

	async createExternalWebhook(
		data: IExternalWebhook,
	): Promise<IExternalWebhook> {
		return ExternalWebhook.create(data);
	}

	async getExternalWebhooks(filters?: {
		isActive?: boolean;
	}): Promise<IExternalWebhook[]> {
		const query: Record<string, unknown> = {};
		if (filters?.isActive !== undefined) query.isActive = filters.isActive;

		return ExternalWebhook.find(query).lean();
	}

	async updateExternalWebhook(
		id: string,
		data: Partial<IExternalWebhook>,
	): Promise<IExternalWebhook | null> {
		return ExternalWebhook.findByIdAndUpdate(id, data, { new: true }).lean();
	}

	async deleteExternalWebhook(id: string): Promise<void> {
		await ExternalWebhook.findByIdAndDelete(id);
	}
}

export const webhookService = new WebhookService();
