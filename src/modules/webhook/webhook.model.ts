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

// External Webhook Configuration Schema
const externalWebhookSchema = new Schema<IExternalWebhook>(
	{
		url: {
			type: String,
			required: true,
		},
		method: {
			type: String,
			required: true,
			enum: ["POST", "GET", "PUT"],
			default: "POST",
		},
		headers: {
			type: Map,
			of: String,
		},
		events: {
			type: [String],
			required: true,
		},
		secret: {
			type: String,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{
		timestamps: true,
	},
);

export const ExternalWebhook = mongoose.model<IExternalWebhook>(
	"ExternalWebhook",
	externalWebhookSchema,
);

import type { IExternalWebhook } from "./webhook.interface";
