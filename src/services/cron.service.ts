import * as cron from "node-cron";

// Store cron jobs
const jobs: Map<string, cron.ScheduledTask> = new Map();

/**
 * Initialize all cron jobs
 */
export const initializeCronJobs = (): void => {
  console.log("⏰ Initializing cron jobs...");

  // Clean up expired sessions (runs every hour)
  const cleanupSessionsJob = cron.schedule("0 * * * *", async () => {
    console.log("🧹 Running cleanup: expired sessions");
    // TODO: Implement session cleanup logic
    // Example: Delete expired JWT refresh tokens from Redis
  });
  jobs.set("cleanupSessions", cleanupSessionsJob);

  // Send daily digest emails (runs at 8 AM daily)
  const dailyDigestJob = cron.schedule("0 8 * * *", async () => {
    console.log("📬 Running daily digest email job");
    // TODO: Implement daily digest logic
    // Example: Send email with popular threads, new replies, etc.
  });
  jobs.set("dailyDigest", dailyDigestJob);

  // Clean up old notifications (runs daily at 2 AM)
  const cleanupNotificationsJob = cron.schedule("0 2 * * *", async () => {
    console.log("🧹 Running cleanup: old notifications");
    // TODO: Implement notification cleanup
    // Example: Delete read notifications older than 30 days
  });
  jobs.set("cleanupNotifications", cleanupNotificationsJob);

  // Update thread statistics (runs every 30 minutes)
  const updateStatsJob = cron.schedule("*/30 * * * *", async () => {
    console.log("📊 Updating thread statistics");
    // TODO: Implement stats update
    // Example: Update view counts, post counts, last activity timestamps
  });
  jobs.set("updateStats", updateStatsJob);

  // Health check ping (runs every 5 minutes)
  const healthCheckJob = cron.schedule("*/5 * * * *", async () => {
    console.log("💓 Health check ping");
    // TODO: Implement health check
    // Example: Ping external monitoring service
  });
  jobs.set("healthCheck", healthCheckJob);

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
