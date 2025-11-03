import { createServer, Server } from "http";
import mongoose from "mongoose";
import app from "./app";
import env from "./config/env";
import { connectRedis, disconnectRedis } from "./config/redis";
import { connectRabbitMQ, disconnectRabbitMQ } from "./config/rabbitmq";
import { initializeSocketIO } from "./config/socket";
import { initializeCronJobs, stopAllCronJobs } from "./services/cron.service";
import logger from "./utils/logger";

let server: Server | null = null;

async function startServer() {
  try {
    // Connect to MongoDB
    await mongoose.connect(env.DATABASE_URL);
    logger.info("✅ MongoDB connected successfully");

    // Connect to Redis
    try {
      connectRedis();
    } catch (redisError) {
      logger.warn("⚠️  Redis connection failed, continuing without cache", {
        error: redisError,
      });
    }

    // Connect to RabbitMQ
    try {
      await connectRabbitMQ();
    } catch (rabbitMQError) {
      logger.warn(
        "⚠️  RabbitMQ connection failed, continuing without queue",
        { error: rabbitMQError }
      );
    }

    // Create HTTP server
    server = createServer(app);

    // Initialize Socket.IO
    initializeSocketIO(server);

    // Initialize cron jobs
    initializeCronJobs();

    // Start HTTP server
    server.listen(env.PORT, () => {
      logger.info(`🚀 Server is running on port ${env.PORT}`);
      logger.info(`📝 Environment: ${env.NODE_ENV}`);
      logger.info(`🌐 API URL: http://localhost:${env.PORT}`);
    });
  } catch (err) {
    logger.error("❌ Failed to start server", err);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`\n${signal} signal received: closing HTTP server`);

  if (server) {
    server.close(async () => {
      logger.info("HTTP server closed");

      // Stop cron jobs
      stopAllCronJobs();

      // Close database connection
      await mongoose.connection.close();
      logger.info("MongoDB connection closed");

      // Close Redis connection
      await disconnectRedis();

      // Close RabbitMQ connection
      await disconnectRabbitMQ();

      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (err) => {
  logger.error("😈 Unhandled Rejection detected, shutting down", err);
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  }
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  logger.error("😈 Uncaught Exception detected, shutting down", err);
  process.exit(1);
});

(async () => {
  await startServer();
})();
