import { createServer, type Server } from "node:http";
import mongoose from "mongoose";
import app from "./app";
import env from "./config/env";
import { connectRabbitMQ, disconnectRabbitMQ } from "./config/rabbitmq";
import { connectRedis, disconnectRedis } from "./config/redis";
import { initializeSocketIO } from "./config/socket";
import { initializeCronJobs, stopAllCronJobs } from "./services/cron.service";
import logger from "./utils/logger";
import { startAIModerationWorker } from "./workers/ai-moderation.worker";
import { startAISummaryWorker } from "./workers/ai-summary.worker";
import { startNotificationWorker } from "./workers/notification.worker";
import { startWebhookWorker } from "./workers/webhook.worker";

let server: Server | null = null;

async function startServer() {
	try {
		await mongoose.connect(env.DATABASE_URL);
		logger.info("MongoDB connected successfully");

		try {
			connectRedis();
		} catch (redisError) {
			logger.warn(
				{
					error: redisError,
				},
				"Redis connection failed, continuing without cache",
			);
		}

		try {
			await connectRabbitMQ();
			await startAIModerationWorker();
			await startAISummaryWorker();
			await startNotificationWorker();
			await startWebhookWorker();
			logger.info("Workers started successfully (AI Moderation, AI Summary, Notification, Webhook)");
		} catch (rabbitMQError) {
			logger.warn(
				{ error: rabbitMQError },
				"RabbitMQ connection failed, continuing without queue",
			);
		}

		server = createServer(app);
		initializeSocketIO(server);
		initializeCronJobs();

		server.listen(env.PORT, () => {
			logger.info(` Server is running on port ${env.PORT}`);
			logger.info(`Environment: ${env.NODE_ENV}`);
			logger.info(` API URL: http://3.1.251.202:${env.PORT}`);
		});
	} catch (err) {
		logger.error({ err }, "Failed to start server");
		process.exit(1);
	}
}

async function gracefulShutdown(signal: string) {
	logger.info(`\n${signal} signal received: closing HTTP server`);

	if (server) {
		server.close(async () => {
			logger.info("HTTP server closed");
			stopAllCronJobs();
			await mongoose.connection.close();
			logger.info("MongoDB connection closed");
			await disconnectRedis();
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
	logger.error({ err }, "😈 Unhandled Rejection detected, shutting down");
	if (server) {
		server.close(() => {
			process.exit(1);
		});
	}
	process.exit(1);
});

process.on("uncaughtException", (err) => {
	logger.error({ err }, "😈 Uncaught Exception detected, shutting down");
	process.exit(1);
});

(async () => {
	await startServer();
})();
