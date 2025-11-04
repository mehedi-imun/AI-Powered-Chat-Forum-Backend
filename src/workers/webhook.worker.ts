import { queueService } from "../services/queue.service";
import logger from "../utils/logger";
import { WebhookLog } from "../modules/webhook/webhook.model";

export async function startWebhookWorker() {
	try {
		logger.info("📨 Starting Webhook Worker...");

		await queueService.consumeQueue("webhooks", async (data: any) => {
			try {
				logger.info({
					type: data.type,
					timestamp: data.timestamp,
					msg: "Processing webhook event from queue",
				});

				switch (data.type) {
					case "email-status": {
						const emailData = data.data;
						logger.info({
							event: emailData.event,
							messageId: emailData.messageId,
							recipient: emailData.recipient,
							msg: `Email ${emailData.event} for message ${emailData.messageId}`,
						});

						await WebhookLog.create({
							event: `email.${emailData.event}.processed`,
							payload: emailData,
							source: "email",
							status: "success",
							timestamp: new Date(),
						});

						break;
					}

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
					source: "queue",
					status: "failed",
					error: error instanceof Error ? error.message : "Unknown error",
					timestamp: new Date(),
				});

				throw error;
			}
		});

		logger.info("✅ Webhook Worker started successfully");
	} catch (error) {
		logger.error({
			error,
			msg: "Failed to start Webhook Worker",
		});
		throw error;
	}
}
