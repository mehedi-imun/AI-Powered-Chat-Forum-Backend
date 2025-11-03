import * as cron from "node-cron";

const jobs: Map<string, cron.ScheduledTask> = new Map();

/**
 * Initialize all cron jobs
 */
export const initializeCronJobs = (): void => {
  console.log("⏰ Initializing cron jobs...");

  const cleanupSessionsJob = cron.schedule("0 * * * *", async () => {
    console.log("🧹 Running cleanup: expired sessions");
  });
  jobs.set("cleanupSessions", cleanupSessionsJob);

  const dailyDigestJob = cron.schedule("0 8 * * *", async () => {
    console.log("📬 Running daily digest email job");
  });
  jobs.set("dailyDigest", dailyDigestJob);

  const cleanupNotificationsJob = cron.schedule("0 2 * * *", async () => {
    console.log("🧹 Running cleanup: old notifications");
  });
  jobs.set("cleanupNotifications", cleanupNotificationsJob);

  const updateStatsJob = cron.schedule("*/30 * * * *", async () => {
    console.log("📊 Updating thread statistics");
  });
  jobs.set("updateStats", updateStatsJob);

  const healthCheckJob = cron.schedule("*/5 * * * *", async () => {
    console.log("💓 Health check ping");
  });
  jobs.set("healthCheck", healthCheckJob);

  const unbanExpiredJob = cron.schedule("0 * * * *", async () => {
    console.log("🔓 Checking for expired bans");
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
        
        console.log(`✅ Unbanned user: ${ban.userId}`);
      }

      if (expiredBans.length > 0) {
        console.log(`✅ Processed ${expiredBans.length} expired bans`);
      }
    } catch (error) {
      console.error("❌ Error processing expired bans:", error);
    }
  });
  jobs.set("unbanExpired", unbanExpiredJob);

  console.log(`✅ ${jobs.size} cron jobs initialized`);
};

/**
 * Stop all cron jobs
 */
export const stopAllCronJobs = (): void => {
  console.log("⏹️  Stopping all cron jobs...");
  jobs.forEach((job, name) => {
    job.stop();
    console.log(`Stopped job: ${name}`);
  });
  jobs.clear();
  console.log("✅ All cron jobs stopped");
};

/**
 * Stop a specific cron job
 */
export const stopCronJob = (jobName: string): void => {
  const job = jobs.get(jobName);
  if (job) {
    job.stop();
    jobs.delete(jobName);
    console.log(`✅ Cron job stopped: ${jobName}`);
  } else {
    console.warn(`⚠️  Cron job not found: ${jobName}`);
  }
};

/**
 * Get all active cron jobs
 */
export const getActiveCronJobs = (): string[] => {
  return Array.from(jobs.keys());
};
