import axios from "axios";
import crypto from "node:crypto";
import { QUEUES } from "../config/rabbitmq";
import { WebhookLog } from "../modules/webhook/webhook.model";
import { queueService } from "../services/queue.service";
import logger from "../utils/logger";

interface WebhookEvent {
	type: string;
	data: Record<string, any>;
	timestamp: string;
	url?: string;
	secret?: string;
	headers?: Record<string, string>;
}

/**
 * Send webhook to external URL
 */
async function sendWebhook(
	url: string,
	payload: Record<string, any>,
	secret?: string,
	headers?: Record<string, string>,
	retries = 3,
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
	const timestamp = Date.now().toString();
	const body = JSON.stringify(payload);

	// Generate signature if secret provided
	let signature = "";
	if (secret) {
		const signedPayload = `${timestamp}.${body}`;
		signature = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
	}

	const webhookHeaders: Record<string, string> = {
		"Content-Type": "application/json",
		"User-Agent": "ChatForum-Webhook/1.0",
		"X-Webhook-Timestamp": timestamp,
		...(signature && { "X-Webhook-Signature": signature }),
		...headers,
	};

	for (let attempt = 0; attempt < retries; attempt++) {
		try {
			const response = await axios.post(url, payload, {
				headers: webhookHeaders,
				timeout: 10000, // 10 seconds
			});

			logger.info({
				url,
				statusCode: response.status,
				attempt: attempt + 1,
				msg: "Webhook sent successfully",
			});

			return { success: true, statusCode: response.status };
		} catch (error: any) {
			logger.error({
				url,
				attempt: attempt + 1,
				error: error.message,
				msg: "Webhook send failed",
			});

			if (attempt === retries - 1) {
				return {
					success: false,
					error: error.message,
					statusCode: error.response?.status,
				};
			}

			// Exponential backoff
			await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
		}
	}

	return { success: false, error: "Max retries exceeded" };
}

export async function startWebhookWorker() {
	try {
		logger.info("📨 Starting Webhook Worker...");

		await queueService.consumeQueue(
			QUEUES.WEBHOOKS,
			async (data: WebhookEvent) => {
				try {
					logger.info({
						type: data.type,
						timestamp: data.timestamp,
						msg: "Processing webhook event from queue",
					});

					// Log the webhook event
					await WebhookLog.create({
						event: data.type,
						payload: data.data,
						source: "notification",
						status: "success",
						timestamp: new Date(),
					});

					// If external URL provided, send webhook
					if (data.url) {
						const result = await sendWebhook(
							data.url,
							{
								event: data.type,
								data: data.data,
								timestamp: data.timestamp,
							},
							data.secret,
							data.headers,
						);

						if (!result.success) {
							logger.error({
								url: data.url,
								type: data.type,
								error: result.error,
								msg: "Failed to send webhook to external URL",
							});

							await WebhookLog.create({
								event: `${data.type}.failed`,
								payload: { ...data.data, error: result.error },
								source: "external",
								status: "failed",
								error: result.error,
								timestamp: new Date(),
							});
						}
					}

					// Handle specific event types
					switch (data.type) {
						case "email-status": {
							const emailData = data.data;
							logger.info({
								event: emailData.event,
								messageId: emailData.messageId,
								recipient: emailData.recipient,
								msg: `Email ${emailData.event} for message ${emailData.messageId}`,
							});
							break;
						}

						case "post.created":
						case "thread.created":
						case "ai.moderation.rejected":
						case "ai.moderation.flagged":
							logger.info({
								type: data.type,
								msg: `Event ${data.type} processed`,
							});
							break;

						default:
							logger.warn({
								type: data.type,
								msg: "Unknown webhook event type",
							});
					}
				} catch (error) {
					logger.error({
						error,
						data,
						msg: "Failed to process webhook event from queue",
					});

					await WebhookLog.create({
						event: "webhook.processing.failed",
						payload: data,
						source: "notification",
						status: "failed",
						error: error instanceof Error ? error.message : "Unknown error",
						timestamp: new Date(),
					});

					throw error;
				}
			},
			{
				prefetch: 5, // Process up to 5 webhooks concurrently
			},
		);

		logger.info("✅ Webhook Worker started successfully");
	} catch (error) {
		logger.error({
			error,
			msg: "Failed to start Webhook Worker",
		});
		throw error;
	}
}
