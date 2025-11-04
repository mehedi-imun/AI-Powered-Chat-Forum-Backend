import { model, Schema } from "mongoose";
import type { INotification } from "./notification.interface";

const notificationSchema = new Schema<INotification>(
	{
		userId: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		type: {
			type: String,
			enum: [
				"mention",
				"reply",
				"thread_comment",
				"post_like",
				"follow",
				"system",
				"post_created",
				"thread_created",
				"ai_moderation_rejected",
				"ai_moderation_flagged",
			],
			required: true,
		},
		title: {
			type: String,
			required: true,
			trim: true,
		},
		message: {
			type: String,
			required: true,
			trim: true,
		},
		link: {
			type: String,
			trim: true,
		},
		relatedUserId: {
			type: Schema.Types.ObjectId,
			ref: "User",
		},
		relatedThreadId: {
			type: Schema.Types.ObjectId,
			ref: "Thread",
		},
		relatedPostId: {
			type: Schema.Types.ObjectId,
			ref: "Post",
		},
		isRead: {
			type: Boolean,
			default: false,
			index: true,
		},
		readAt: {
			type: Date,
		},
	},
	{
		timestamps: true,
	},
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1 });

notificationSchema.index(
	{ createdAt: 1 },
	{ expireAfterSeconds: 90 * 24 * 60 * 60 },
);

export const Notification = model<INotification>(
	"Notification",
	notificationSchema,
);
