import logger from "../utils/logger";
import { QUEUES } from "../config/rabbitmq";
import { cacheService } from "../config/redis";
import { Post } from "../modules/post/post.model";
import { Thread } from "../modules/thread/thread.model";
import { AIService } from "../services/ai.service";
import { queueService } from "../services/queue.service";

export const startAISummaryWorker = async (): Promise<void> => {
  logger.info("Starting AI Summary Worker...");

  await queueService.consumeQueue(
    QUEUES.AI_SUMMARY,
    async (message: any) => {
      try {
        logger.info(
          `Raw summary message: ${JSON.stringify(message, null, 2)}`
        );

        const { threadId } = message;

        logger.info(`Generating summary for thread: ${threadId}`);

        const thread = await Thread.findById(threadId);
        if (!thread) {
          logger.error(`Thread not found: ${threadId}`);
          return;
        }

        const posts = await Post.find({
          threadId,
          status: "active",
          moderationStatus: { $nin: ["rejected"] },
        })
          .populate("author", "name")
          .sort({ createdAt: 1 })
          .limit(100)
          .lean();

        if (posts.length === 0) {
          logger.info(`No posts found for thread ${threadId}`);
          return;
        }

        const formattedPosts = posts.map((post: any) => ({
          content: post.content,
          author: post.author?.name || "Anonymous",
          createdAt: post.createdAt,
        }));

        const summaryResult = await AIService.generateThreadSummary(
          formattedPosts
        );

        const cacheKey = `thread:summary:${threadId}`;
        await cacheService.setJSON(cacheKey, summaryResult, 3600);

        logger.info(`Summary generated for thread ${threadId}`);
        logger.info(
          `   Summary: ${summaryResult.summary.substring(0, 100)}...`
        );
        logger.info(`   Key Points: ${summaryResult.keyPoints.length}`);
        logger.info(`   Sentiment: ${summaryResult.sentimentScore}`);
      } catch (error: any) {
        logger.error("AI Summary Worker error");
        throw error; // Re-throw to trigger retry
      }
    },
    {
      prefetch: 2, // Process up to 2 summaries concurrently
    }
  );

  logger.info("AI Summary Worker started");
};

export const stopAISummaryWorker = async (): Promise<void> => {
  logger.info("Stopping AI Summary Worker...");
};
