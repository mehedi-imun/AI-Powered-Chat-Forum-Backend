import logger from "../utils/logger";
import * as cron from "node-cron";

const jobs: Map<string, cron.ScheduledTask> = new Map();

export const initializeCronJobs = (): void => {
	logger.info(" Initializing cron jobs...");

	const cleanupSessionsJob = cron.schedule("0 * * * *", async () => {
		logger.info(" Running cleanup: expired sessions");
	});
	jobs.set("cleanupSessions", cleanupSessionsJob);

	const dailyDigestJob = cron.schedule("0 8 * * *", async () => {
		logger.info(" Running daily digest email job");
	});
	jobs.set("dailyDigest", dailyDigestJob);

	const cleanupNotificationsJob = cron.schedule("0 2 * * *", async () => {
		logger.info(" Running cleanup: old notifications");
	});
	jobs.set("cleanupNotifications", cleanupNotificationsJob);

	const updateStatsJob = cron.schedule("*/30 * * * *", async () => {
		logger.info(" Updating thread statistics");
	});
	jobs.set("updateStats", updateStatsJob);

	const healthCheckJob = cron.schedule("*/5 * * * *", async () => {
		logger.info(" Health check ping");
	});
	jobs.set("healthCheck", healthCheckJob);

	const unbanExpiredJob = cron.schedule("0 * * * *", async () => {
		logger.info(" Checking for expired bans");
		try {
			const { Ban } = await import("../modules/admin/admin.model");
			const { User } = await import("../modules/user/user.model");

			const now = new Date();
			const expiredBans = await Ban.find({
				isActive: true,
				expiresAt: { $lte: now },
			});

			for (const ban of expiredBans) {
				ban.isActive = false;
				await ban.save();
				await User.findByIdAndUpdate(ban.userId, { isActive: true });

				logger.info(` Unbanned user: ${ban.userId}`);
			}

			if (expiredBans.length > 0) {
				logger.info(` Processed ${expiredBans.length} expired bans`);
			}
		} catch (error) {
			logger.error(" Error processing expired bans");
		}
	});
	jobs.set("unbanExpired", unbanExpiredJob);

	logger.info(` ${jobs.size} cron jobs initialized`);
};

export const stopAllCronJobs = (): void => {
	logger.info("Stopping all cron jobs...");
	jobs.forEach((job, name) => {
		job.stop();
		logger.info(`Stopped job: ${name}`);
	});
	jobs.clear();
	logger.info(" All cron jobs stopped");
};

export const stopCronJob = (jobName: string): void => {
	const job = jobs.get(jobName);
	if (job) {
		job.stop();
		jobs.delete(jobName);
		logger.info(`Cron job stopped: ${jobName}`);
	} else {
		logger.warn(`Cron job not found: ${jobName}`);
	}
};

export const getActiveCronJobs = (): string[] => {
	return Array.from(jobs.keys());
};
