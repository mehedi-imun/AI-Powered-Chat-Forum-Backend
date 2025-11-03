import amqp, { Channel, Connection } from "amqplib";
import env from "./env";

let connection: Connection | null = null;
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
    connection = await amqp.connect(env.RABBITMQ_URL);
    console.log("✅ RabbitMQ connected successfully");

    // Create channel
    channel = await connection.createChannel();
    console.log("✅ RabbitMQ channel created");

    // Declare queues
    await Promise.all([
      channel.assertQueue(QUEUES.NOTIFICATIONS, { durable: true }),
      channel.assertQueue(QUEUES.AI_MODERATION, { durable: true }),
      channel.assertQueue(QUEUES.AI_SUMMARY, { durable: true }),
      channel.assertQueue(QUEUES.WEBHOOKS, { durable: true }),
      channel.assertQueue(QUEUES.EMAIL, { durable: true }),
    ]);

    console.log("✅ RabbitMQ queues declared:", Object.values(QUEUES).join(", "));

    // Handle connection errors
    connection.on("error", (err) => {
      console.error("❌ RabbitMQ connection error:", err);
    });

    connection.on("close", () => {
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

export const getRabbitMQConnection = (): Connection | null => {
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
