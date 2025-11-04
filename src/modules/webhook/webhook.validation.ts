import { z } from "zod";

export const emailStatusWebhookSchema = z.object({
	body: z.object({
		event: z.enum([
			"delivered",
			"failed",
			"bounced",
			"spam",
			"opened",
			"clicked",
		]),
		messageId: z.string().min(1, "Message ID is required"),
		recipient: z.string().email("Invalid recipient email"),
		timestamp: z
			.string()
			.or(z.date())
			.transform((val) => new Date(val)),
		reason: z.string().optional(),
		metadata: z.record(z.string(), z.unknown()).optional(),
	}),
});

export const webhookSignatureSchema = z.object({
	headers: z.object({
		"x-webhook-signature": z.string().min(1, "Signature is required"),
		"x-webhook-timestamp": z.string().min(1, "Timestamp is required"),
	}),
});

export const notificationWebhookSchema = z.object({
	body: z.object({
		event: z.enum([
			"notification.sent",
			"notification.delivered",
			"notification.failed",
			"notification.clicked",
		]),
		notificationId: z.string().min(1, "Notification ID is required"),
		userId: z.string().min(1, "User ID is required"),
		type: z.string().min(1, "Notification type is required"),
		timestamp: z
			.string()
			.or(z.date())
			.transform((val) => new Date(val)),
		metadata: z.record(z.string(), z.unknown()).optional(),
	}),
});

export const createExternalWebhookSchema = z.object({
	body: z.object({
		url: z.string().url("Invalid URL"),
		method: z.enum(["POST", "GET", "PUT"]).default("POST"),
		headers: z.record(z.string(), z.string()).optional(),
		events: z.array(z.string()).min(1, "At least one event is required"),
		secret: z.string().optional(),
		isActive: z.boolean().default(true),
	}),
});

export const updateExternalWebhookSchema = z.object({
	body: z.object({
		url: z.string().url("Invalid URL").optional(),
		method: z.enum(["POST", "GET", "PUT"]).optional(),
		headers: z.record(z.string(), z.string()).optional(),
		events: z.array(z.string()).min(1, "At least one event is required").optional(),
		secret: z.string().optional(),
		isActive: z.boolean().optional(),
	}),
});

export type EmailStatusWebhookInput = z.infer<
	typeof emailStatusWebhookSchema
>;
export type WebhookSignatureInput = z.infer<typeof webhookSignatureSchema>;
export type NotificationWebhookInput = z.infer<
	typeof notificationWebhookSchema
>;
export type CreateExternalWebhookInput = z.infer<
	typeof createExternalWebhookSchema
>;
export type UpdateExternalWebhookInput = z.infer<
	typeof updateExternalWebhookSchema
>;
