import { queueService } from "../services/queue.service";
import { QUEUES } from "../config/rabbitmq";
import { AIService } from "../services/ai.service";
import { Post } from "../modules/post/post.model";
import { Thread } from "../modules/thread/thread.model";
import { cacheService } from "../config/redis";

/**
 * AI Summary Worker
 * Consumes jobs from 'ai-summary' queue
 * Generates thread summaries using AI
 */
export const startAISummaryWorker = async (): Promise<void> => {
  console.log("📝 Starting AI Summary Worker...");

  await queueService.consumeQueue(
    QUEUES.AI_SUMMARY,
    async (message: any) => {
      try {
        console.log('📦 Raw summary message:', JSON.stringify(message, null, 2));
        
        const { threadId } = message;

        console.log(`📊 Generating summary for thread: ${threadId}`);

        const thread = await Thread.findById(threadId);
        if (!thread) {
          console.error(`❌ Thread not found: ${threadId}`);
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
          console.log(`⚠️  No posts found for thread ${threadId}`);
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

        console.log(`✅ Summary generated for thread ${threadId}`);
        console.log(`   Summary: ${summaryResult.summary.substring(0, 100)}...`);
        console.log(`   Key Points: ${summaryResult.keyPoints.length}`);
        console.log(`   Sentiment: ${summaryResult.sentimentScore}`);
      } catch (error: any) {
        console.error("❌ AI Summary Worker error:", error.message);
        throw error; // Re-throw to trigger retry
      }
    },
    {
      prefetch: 2, // Process up to 2 summaries concurrently
    }
  );

  console.log("✅ AI Summary Worker started");
};

/**
 * Stop AI Summary Worker
 */
export const stopAISummaryWorker = async (): Promise<void> => {
  console.log("⏹️  Stopping AI Summary Worker...");
};
