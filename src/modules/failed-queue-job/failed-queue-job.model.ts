import { model, Schema } from "mongoose";
import type { IFailedQueueJob } from "./failed-queue-job.interface";

const failedQueueJobSchema = new Schema<IFailedQueueJob>(
	{
		queue: {
			type: String,
			required: true,
			trim: true,
		},
		payload: {
			type: Schema.Types.Mixed,
			required: true,
		},
		retryCount: {
			type: Number,
			required: true,
			default: 0,
		},
		lastError: {
			type: String,
			required: true,
		},
		status: {
			type: String,
			enum: ["failed", "replayed"],
			default: "failed",
			index: true,
		},
		failedAt: {
			type: Date,
			required: true,
		},
		replayedAt: {
			type: Date,
		},
	},
	{
		timestamps: true,
	},
);

failedQueueJobSchema.index({ status: 1, failedAt: -1 });
failedQueueJobSchema.index({ failedAt: 1 }, { expireAfterSeconds: 2592000 });

export const FailedQueueJob = model<IFailedQueueJob>(
	"FailedQueueJob",
	failedQueueJobSchema,
);
