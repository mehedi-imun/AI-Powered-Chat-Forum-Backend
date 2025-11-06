import logger from "../utils/logger";
import { Types } from "mongoose";
import { QUEUES } from "../config/rabbitmq";
import { Report } from "../modules/admin/admin.model";
import { NotificationService } from "../modules/notification/notification.service";
import { Post } from "../modules/post/post.model";
import { Thread } from "../modules/thread/thread.model";
import { AIService } from "../services/ai.service";
import {
  type AIModerationQueueData,
  queueService,
} from "../services/queue.service";

export const startAIModerationWorker = async (): Promise<void> => {
  logger.info("🤖 Starting AI Moderation Worker...");

  await queueService.consumeQueue(
    QUEUES.AI_MODERATION,
    async (message: AIModerationQueueData) => {
      try {
        logger.info(`📦 Received message: ${JSON.stringify(message, null, 2)}`);

        const { postId, content, authorId } = message;

        logger.info(`🔍 Moderating post: ${postId}`);

        const moderationResult = await AIService.moderateContent(content);

        const post = await Post.findById(postId);
        if (!post) {
          logger.error(`❌ Post not found: ${postId}`);
          return;
        }

        post.aiScore = {
          spam: moderationResult.spamScore,
          toxicity: moderationResult.toxicityScore,
          inappropriate: moderationResult.inappropriateScore,
        };
        post.aiReasoning = moderationResult.reasoning;
        post.aiRecommendation = moderationResult.recommendation;

        if (moderationResult.recommendation === "reject") {
          post.moderationStatus = "rejected";
          post.status = "deleted";
          logger.info(
            `🚫 Post ${postId} rejected by AI: ${moderationResult.reasoning}`
          );

          await Report.create({
            reportedContentType: "post",
            reportedContentId: new Types.ObjectId(postId),
            reportType: moderationResult.isSpam
              ? "spam"
              : moderationResult.isToxic
              ? "harassment"
              : "inappropriate",
            description: `AI Moderation: ${moderationResult.reasoning}. Scores - Spam: ${moderationResult.spamScore}, Toxicity: ${moderationResult.toxicityScore}, Inappropriate: ${moderationResult.inappropriateScore}`,
            reportedBy: new Types.ObjectId(authorId), // System report
            status: "reviewing",
          });

          const thread = await Thread.findById(post.threadId);
          if (thread) {
            await NotificationService.createAIModerationRejectedNotification(
              authorId,
              postId,
              post.threadId.toString(),
              thread.title,
              moderationResult.reasoning
            );
          }
        } else if (moderationResult.recommendation === "review") {
          post.moderationStatus = "flagged";
          logger.info(
            `⚠️  Post ${postId} flagged for review: ${moderationResult.reasoning}`
          );

          await Report.create({
            reportedContentType: "post",
            reportedContentId: new Types.ObjectId(postId),
            reportType: moderationResult.isSpam
              ? "spam"
              : moderationResult.isToxic
              ? "harassment"
              : "inappropriate",
            description: `AI Moderation (Review Needed): ${moderationResult.reasoning}`,
            reportedBy: new Types.ObjectId(authorId),
            status: "pending",
          });

          const thread = await Thread.findById(post.threadId);
          if (thread) {
            await NotificationService.createAIModerationFlaggedNotification(
              authorId,
              postId,
              post.threadId.toString(),
              thread.title,
              moderationResult.reasoning
            );
          }
        } else {
          post.moderationStatus = "approved";
          logger.info(`✅ Post ${postId} approved by AI`);
        }

        await post.save();

        logger.info(
          `✅ Moderation complete for post ${postId}: ${moderationResult.recommendation}`
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        logger.error("❌ AI Moderation Worker error");
        throw error;
      }
    },
    {
      prefetch: 5,
    }
  );

  logger.info("✅ AI Moderation Worker started");
};

export const stopAIModerationWorker = async (): Promise<void> => {
  logger.info("⏹️  Stopping AI Moderation Worker...");
};
