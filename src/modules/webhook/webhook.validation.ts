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

export type EmailStatusWebhookInput = z.infer<
	typeof emailStatusWebhookSchema
>;
export type WebhookSignatureInput = z.infer<typeof webhookSignatureSchema>;
