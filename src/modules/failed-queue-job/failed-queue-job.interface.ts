import type { Types } from "mongoose";

export interface IFailedQueueJob {
	_id?: Types.ObjectId;
	queue: string;
	payload: Record<string, unknown>;
	retryCount: number;
	lastError: string;
	status: "failed" | "replayed";
	failedAt: Date;
	replayedAt?: Date;
	createdAt?: Date;
	updatedAt?: Date;
}
