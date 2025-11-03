import { getRabbitMQChannel, QUEUES } from "../config/rabbitmq";
import * as amqp from "amqplib";

export interface QueueMessage<T = any> {
  data: T;
  timestamp: Date;
  retryCount?: number;
}

export class QueueService {
  private channel: amqp.Channel | null = null;

  constructor() {
    this.channel = getRabbitMQChannel();
  }

  /**
   * Publish a message to a queue
   */
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
        console.error("RabbitMQ channel not available");
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
        console.log(`📤 Message published to queue: ${queueName}`);
      }

      return sent;
    } catch (error) {
      console.error(`Error publishing to queue ${queueName}:`, error);
      return false;
    }
  }

  /**
   * Consume messages from a queue
   */
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

      // Set prefetch count (how many messages to process at once)
      this.channel.prefetch(options?.prefetch ?? 1);

      console.log(`👂 Listening to queue: ${queueName}`);

      await this.channel.consume(
        queueName,
        async (msg: amqp.ConsumeMessage | null) => {
          if (!msg) return;

          try {
            const content: QueueMessage<T> = JSON.parse(
              msg.content.toString()
            );
            console.log(`📥 Processing message from queue: ${queueName}`);

            // Execute handler
            await handler(content.data, msg);

            // Acknowledge message
            this.channel?.ack(msg);
            console.log(`✅ Message processed from queue: ${queueName}`);
          } catch (error) {
            console.error(`Error processing message from ${queueName}:`, error);

            // Reject message and requeue (with limit)
            const retryCount = (msg.properties.headers?.retryCount || 0) + 1;
            const maxRetries = 3;

            if (retryCount < maxRetries) {
              console.log(
                `♻️  Requeuing message (attempt ${retryCount}/${maxRetries})`
              );
              this.channel?.nack(msg, false, true);
            } else {
              console.error(
                `❌ Message failed after ${maxRetries} attempts, rejecting`
              );
              this.channel?.nack(msg, false, false); // Don't requeue
            }
          }
        },
        { noAck: false }
      );
    } catch (error) {
      console.error(`Error consuming queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Acknowledge a message manually
   */
  ackMessage(message: amqp.ConsumeMessage): void {
    this.channel?.ack(message);
  }

  /**
   * Reject a message (optionally requeue)
   */
  nackMessage(message: amqp.ConsumeMessage, requeue = false): void {
    this.channel?.nack(message, false, requeue);
  }

  /**
   * Purge all messages from a queue
   */
  async purgeQueue(queueName: string): Promise<void> {
    if (!this.channel) {
      throw new Error("RabbitMQ channel not available");
    }
    await this.channel.purgeQueue(queueName);
    console.log(`🗑️  Queue purged: ${queueName}`);
  }

  /**
   * Get queue message count
   */
  async getQueueMessageCount(queueName: string): Promise<number> {
    if (!this.channel) {
      throw new Error("RabbitMQ channel not available");
    }
    const info = await this.channel.checkQueue(queueName);
    return info.messageCount;
  }
}

// Export singleton instance
export const queueService = new QueueService();

// Helper functions for common queue operations
export const publishNotification = (data: any) =>
  queueService.publishToQueue(QUEUES.NOTIFICATIONS, data);

export const publishAIModeration = (data: any) =>
  queueService.publishToQueue(QUEUES.AI_MODERATION, data);

export const publishAISummary = (data: any) =>
  queueService.publishToQueue(QUEUES.AI_SUMMARY, data);

export const publishWebhook = (data: any) =>
  queueService.publishToQueue(QUEUES.WEBHOOKS, data);

export const publishEmail = (data: any) =>
  queueService.publishToQueue(QUEUES.EMAIL, data);
