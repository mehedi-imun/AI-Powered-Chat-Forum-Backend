import mongoose, { Schema } from "mongoose";
import type { IWebhookLog } from "./webhook.interface";

const webhookLogSchema = new Schema<IWebhookLog>(
	{
		event: {
			type: String,
			required: true,
			index: true,
		},
		payload: {
			type: Schema.Types.Mixed,
			required: true,
		},
		source: {
			type: String,
			required: true,
			enum: ["email", "payment", "notification", "external"],
			default: "email",
		},
		status: {
			type: String,
			required: true,
			enum: ["success", "failed"],
			default: "success",
		},
		error: {
			type: String,
		},
		timestamp: {
			type: Date,
			default: Date.now,
			index: true,
		},
	},
	{
		timestamps: true,
	},
);

webhookLogSchema.index({ timestamp: -1 });
webhookLogSchema.index({ event: 1, timestamp: -1 });

export const WebhookLog = mongoose.model<IWebhookLog>(
	"WebhookLog",
	webhookLogSchema,
);
