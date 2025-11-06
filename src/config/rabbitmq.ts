import logger from "../utils/logger";
import amqp, { type Channel, type ChannelModel } from "amqplib";
import env from "./env";

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

export const QUEUES = {
  NOTIFICATIONS: "notifications",
  AI_MODERATION: "ai-moderation",
  AI_SUMMARY: "ai-summary",
  WEBHOOKS: "webhooks",
  EMAIL: "email",
};

export const connectRabbitMQ = async (): Promise<void> => {
  try {
    const conn = await amqp.connect(env.RABBITMQ_URL);
    connection = conn;
    logger.info("✅ RabbitMQ connected successfully");

    const ch = await conn.createChannel();
    channel = ch;
    logger.info("✅ RabbitMQ channel created");

    await Promise.all([
      ch.assertQueue(QUEUES.NOTIFICATIONS, { durable: true }),
      ch.assertQueue(QUEUES.AI_MODERATION, { durable: true }),
      ch.assertQueue(QUEUES.AI_SUMMARY, { durable: true }),
      ch.assertQueue(QUEUES.WEBHOOKS, { durable: true }),
      ch.assertQueue(QUEUES.EMAIL, { durable: true }),
    ]);

    logger.info(
      `✅ RabbitMQ queues declared: ${Object.values(QUEUES).join(", ")}`
    );

    conn.on("error", (err: Error) => {
      logger.error("❌ RabbitMQ connection error");
    });

    conn.on("close", () => {
      logger.warn("⚠️  RabbitMQ connection closed");
    });
  } catch (error) {
    logger.error("❌ Failed to connect to RabbitMQ");
    throw error;
  }
};

export const getRabbitMQChannel = (): Channel | null => {
  return channel;
};

export const getRabbitMQConnection = (): ChannelModel | null => {
  return connection;
};

export const disconnectRabbitMQ = async (): Promise<void> => {
  try {
    if (channel) {
      await channel.close();
      logger.info("✅ RabbitMQ channel closed");
    }
    if (connection) {
      await connection.close();
      logger.info("✅ RabbitMQ disconnected successfully");
    }
  } catch (error) {
    logger.error("❌ Error disconnecting RabbitMQ");
  } finally {
    channel = null;
    connection = null;
  }
};

export const queueService = {
  publishToQueue: async (queueName: string, message: any): Promise<void> => {
    if (!channel) {
      throw new Error("RabbitMQ channel not initialized");
    }

    const messageBuffer = Buffer.from(JSON.stringify(message));
    channel.sendToQueue(queueName, messageBuffer, {
      persistent: true,
    });
  },

  consumeQueue: async (
    queueName: string,
    callback: (message: any) => Promise<void>,
    options: { prefetch?: number } = {}
  ): Promise<void> => {
    if (!channel) {
      throw new Error("RabbitMQ channel not initialized");
    }

    if (options.prefetch) {
      channel.prefetch(options.prefetch);
    }

    channel.consume(queueName, async (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          await callback(content);
          channel?.ack(msg); // Acknowledge successful processing
        } catch (error) {
          logger.error(
            `❌ Error processing message from ${queueName}: ${error}`
          );
          channel?.nack(msg, false, true);
        }
      }
    });
  },
};
