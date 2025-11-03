import { queueService } from "../config/rabbitmq";
import { AIService } from "../services/ai.service";
import { Post } from "../modules/post/post.model";
import { User } from "../modules/user/user.model";
import { Report } from "../modules/admin/admin.model";
import { Types } from "mongoose";

/**
 * AI Moderation Worker
 * Consumes jobs from 'ai-moderation' queue
 * Analyzes post content for spam, toxicity, and inappropriate content
 */
export const startAIModerationWorker = async (): Promise<void> => {
  console.log("🤖 Starting AI Moderation Worker...");

  await queueService.consumeQueue(
    "ai-moderation",
    async (message: any) => {
      try {
        const { postId, content, authorId } = message;

        console.log(`🔍 Moderating post: ${postId}`);

        // Call AI service to moderate content
        const moderationResult = await AIService.moderateContent(content);

        // Update post with moderation results
        const post = await Post.findById(postId);
        if (!post) {
          console.error(`❌ Post not found: ${postId}`);
          return;
        }

        // Store AI scores
        post.aiScore = {
          spam: moderationResult.spamScore,
          toxicity: moderationResult.toxicityScore,
          inappropriate: moderationResult.inappropriateScore,
        };

        // Update moderation status based on AI recommendation
        if (moderationResult.recommendation === "reject") {
          post.moderationStatus = "rejected";
          post.status = "deleted";
          console.log(`🚫 Post ${postId} rejected by AI: ${moderationResult.reasoning}`);

          // Create automatic report for admin review
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
        } else if (moderationResult.recommendation === "review") {
          post.moderationStatus = "flagged";
          console.log(`⚠️  Post ${postId} flagged for review: ${moderationResult.reasoning}`);

          // Create report for moderator review
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
        } else {
          post.moderationStatus = "approved";
          console.log(`✅ Post ${postId} approved by AI`);
        }

        await post.save();

        console.log(
          `✅ Moderation complete for post ${postId}: ${moderationResult.recommendation}`
        );
      } catch (error: any) {
        console.error("❌ AI Moderation Worker error:", error.message);
        throw error; // Re-throw to trigger retry
      }
    },
    {
      prefetch: 5, // Process up to 5 messages concurrently
    }
  );

  console.log("✅ AI Moderation Worker started");
};

/**
 * Stop AI Moderation Worker
 */
export const stopAIModerationWorker = async (): Promise<void> => {
  console.log("⏹️  Stopping AI Moderation Worker...");
  // Worker will stop when RabbitMQ connection closes
};
