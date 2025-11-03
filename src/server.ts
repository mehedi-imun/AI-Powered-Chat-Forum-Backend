import { Server } from "http";
import mongoose from "mongoose";
import app from "./app";
import env from "./config/env";
import { connectRedis, disconnectRedis } from "./config/redis";
import { initializeCronJobs } from "./services/cron.service";

let server: Server | null = null;

async function startServer() {
  try {
    // Connect to MongoDB
    await mongoose.connect(env.DATABASE_URL);
    console.log("✅ MongoDB connected successfully");

    // Connect to Redis
    try {
      connectRedis();
    } catch (redisError) {
      console.warn(
        "⚠️  Redis connection failed, continuing without cache:",
        redisError
      );
    }

    // Initialize cron jobs for trial expiry checks
    initializeCronJobs();

    // Start HTTP server
    server = app.listen(env.PORT, () => {
      console.log(`🚀 Server is running on port ${env.PORT}`);
      console.log(`📝 Environment: ${env.NODE_ENV}`);
      console.log(`🌐 API URL: http://localhost:${env.PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`\n${signal} signal received: closing HTTP server`);

  if (server) {
    server.close(async () => {
      console.log("HTTP server closed");

      // Close database connection
      await mongoose.connection.close();
      console.log("MongoDB connection closed");

      // Close Redis connection
      await disconnectRedis();

      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (err) => {
  console.error("😈 Unhandled Rejection detected, shutting down...", err);
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  }
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("😈 Uncaught Exception detected, shutting down...", err);
  process.exit(1);
});

(async () => {
  await startServer();
})();
