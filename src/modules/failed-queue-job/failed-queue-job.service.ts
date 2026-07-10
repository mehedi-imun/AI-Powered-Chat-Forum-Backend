import type { IFailedQueueJob } from "./failed-queue-job.interface";
import { FailedQueueJob } from "./failed-queue-job.model";

const save = async (data: {
	queue: string;
	payload: Record<string, unknown>;
	retryCount: number;
	lastError: string;
}): Promise<IFailedQueueJob> => {
	const job = await FailedQueueJob.create({
		queue: data.queue,
		payload: data.payload,
		retryCount: data.retryCount,
		lastError: data.lastError,
		failedAt: new Date(),
	});
	return job;
};

const countPending = async (): Promise<number> => {
	return FailedQueueJob.countDocuments({ status: "failed" });
};

const getFailedJobs = async (
	page: number,
	limit: number,
): Promise<{ jobs: IFailedQueueJob[]; total: number; totalPage: number }> => {
	const skip = (page - 1) * limit;

	const [jobs, total] = await Promise.all([
		FailedQueueJob.find({ status: "failed" })
			.sort({ failedAt: -1 })
			.skip(skip)
			.limit(limit)
			.lean(),
		FailedQueueJob.countDocuments({ status: "failed" }),
	]);

	return {
		jobs: jobs as IFailedQueueJob[],
		total,
		totalPage: Math.ceil(total / limit),
	};
};

const markReplayed = async (id: string): Promise<IFailedQueueJob | null> => {
	return FailedQueueJob.findByIdAndUpdate(
		id,
		{ status: "replayed", replayedAt: new Date() },
		{ new: true },
	);
};

export const FailedQueueJobService = {
	save,
	countPending,
	getFailedJobs,
	markReplayed,
};
