import type * as amqp from "amqplib";
import { getRabbitMQChannel, QUEUES } from "../config/rabbitmq";
import logger from "../utils/logger";

export interface QueueMessage<T = unknown> {
  data: T;
  timestamp: Date;
  retryCount?: number;
}

export interface NotificationQueueData {
  type: string;
  userId: string;
  postId?: string;
  threadId?: string;
  repliedBy?: string;
  mentionedBy?: string;
}
export interface AIModerationQueueData {
  postId: string;
  content: string;
  authorId: string;
}

export interface AISummaryQueueData {
  threadId: string;
  posts?: string;
}
export interface WebhookQueueData {
  url: string;
  event: string;
  payload: Record<string, unknown>;
}

export interface EmailQueueData {
  to: string;
  subject: string;
  html: string;
  type: string;
}

export class QueueService {
  private channel: amqp.Channel | null = null;

  constructor() {
    this.channel = getRabbitMQChannel();
  }

  async publishToQueue<T>(
    queueName: string,
    data: T,
    options?: {
      persistent?: boolean;
      priority?: number;
    }
  ): Promise<boolean> {
    try {
      if (!this.channel) {
        this.channel = getRabbitMQChannel();
      }

      if (!this.channel) {
        logger.error("RabbitMQ channel not available");
        return false;
      }

      const message: QueueMessage<T> = {
        data,
        timestamp: new Date(),
        retryCount: 0,
      };

      const sent = this.channel.sendToQueue(
        queueName,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: options?.persistent ?? true,
          priority: options?.priority ?? 0,
        }
      );

      if (sent) {
        logger.info(` Message published to queue: ${queueName}`);
      }

      return sent;
    } catch (error) {
      logger.error(`Error publishing to queue ${queueName}:`);
      return false;
    }
  }

  async consumeQueue<T>(
    queueName: string,
    handler: (data: T, message: amqp.ConsumeMessage) => Promise<void>,
    options?: {
      prefetch?: number;
    }
  ): Promise<void> {
    try {
      if (!this.channel) {
        this.channel = getRabbitMQChannel();
      }

      if (!this.channel) {
        throw new Error("RabbitMQ channel not available");
      }

      this.channel.prefetch(options?.prefetch ?? 1);
      logger.info(`Listening to queue: ${queueName}`);

      await this.channel.consume(
        queueName,
        async (msg: amqp.ConsumeMessage | null) => {
          if (!msg) return;

          try {
            const content: QueueMessage<T> = JSON.parse(msg.content.toString());
            logger.info(`Processing message from queue: ${queueName}`);

            await handler(content.data, msg);
            this.channel?.ack(msg);
            logger.info(`Message processed from queue: ${queueName}`);
          } catch (error) {
            logger.error(`Error processing message from ${queueName}:`);

            const retryCount = (msg.properties.headers?.retryCount || 0) + 1;
            const maxRetries = 3;

            if (retryCount < maxRetries) {
              logger.info(
                `♻Requeuing message (attempt ${retryCount}/${maxRetries})`
              );
              this.channel?.nack(msg, false, true);
            } else {
              logger.error(
                `Message failed after ${maxRetries} attempts, rejecting`
              );
              this.channel?.nack(msg, false, false);
            }
          }
        },
        { noAck: false }
      );
    } catch (error) {
      logger.error(`Error consuming queue ${queueName}:`);
      throw error;
    }
  }

  ackMessage(message: amqp.ConsumeMessage): void {
    this.channel?.ack(message);
  }

  nackMessage(message: amqp.ConsumeMessage, requeue = false): void {
    this.channel?.nack(message, false, requeue);
  }

  async purgeQueue(queueName: string): Promise<void> {
    if (!this.channel) {
      throw new Error("RabbitMQ channel not available");
    }
    await this.channel.purgeQueue(queueName);
    logger.info(`Queue purged: ${queueName}`);
  }

  async getQueueMessageCount(queueName: string): Promise<number> {
    if (!this.channel) {
      throw new Error("RabbitMQ channel not available");
    }
    const info = await this.channel.checkQueue(queueName);
    return info.messageCount;
  }
}

export const queueService = new QueueService();

export const publishNotification = (data: NotificationQueueData) =>
  queueService.publishToQueue(QUEUES.NOTIFICATIONS, data);

export const publishAIModeration = (data: AIModerationQueueData) =>
  queueService.publishToQueue(QUEUES.AI_MODERATION, data);

export const publishAISummary = (data: AISummaryQueueData) =>
  queueService.publishToQueue(QUEUES.AI_SUMMARY, data);

export const publishWebhook = (data: WebhookQueueData) =>
  queueService.publishToQueue(QUEUES.WEBHOOKS, data);

export const publishEmail = (data: EmailQueueData) =>
  queueService.publishToQueue(QUEUES.EMAIL, data);
