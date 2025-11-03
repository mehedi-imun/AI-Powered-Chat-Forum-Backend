import amqp, { type ChannelModel, type Channel } from "amqplib";
import env from "./env";

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

// Queue names
export const QUEUES = {
  NOTIFICATIONS: "notifications",
  AI_MODERATION: "ai-moderation",
  AI_SUMMARY: "ai-summary",
  WEBHOOKS: "webhooks",
  EMAIL: "email",
};

export const connectRabbitMQ = async (): Promise<void> => {
  try {
    // Connect to RabbitMQ
    const conn = await amqp.connect(env.RABBITMQ_URL);
    connection = conn;
    console.log("✅ RabbitMQ connected successfully");

    // Create channel
    const ch = await conn.createChannel();
    channel = ch;
    console.log("✅ RabbitMQ channel created");

    // Declare queues
    await Promise.all([
      ch.assertQueue(QUEUES.NOTIFICATIONS, { durable: true }),
      ch.assertQueue(QUEUES.AI_MODERATION, { durable: true }),
      ch.assertQueue(QUEUES.AI_SUMMARY, { durable: true }),
      ch.assertQueue(QUEUES.WEBHOOKS, { durable: true }),
      ch.assertQueue(QUEUES.EMAIL, { durable: true }),
    ]);

    console.log("✅ RabbitMQ queues declared:", Object.values(QUEUES).join(", "));

    // Handle connection errors
    conn.on("error", (err: Error) => {
      console.error("❌ RabbitMQ connection error:", err);
    });

    conn.on("close", () => {
      console.warn("⚠️  RabbitMQ connection closed");
    });
  } catch (error) {
    console.error("❌ Failed to connect to RabbitMQ:", error);
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
      console.log("✅ RabbitMQ channel closed");
    }
    if (connection) {
      await connection.close();
      console.log("✅ RabbitMQ disconnected successfully");
    }
  } catch (error) {
    console.error("❌ Error disconnecting RabbitMQ:", error);
  } finally {
    channel = null;
    connection = null;
  }
};
