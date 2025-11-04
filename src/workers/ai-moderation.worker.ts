import { Types } from "mongoose";
import { QUEUES } from "../config/rabbitmq";
import { Report } from "../modules/admin/admin.model";
import { Post } from "../modules/post/post.model";
import { AIService } from "../services/ai.service";
import { queueService } from "../services/queue.service";

/**
 * AI Moderation Worker
 * Consumes jobs from 'ai-moderation' queue
 * Analyzes post content for spam, toxicity, and inappropriate content
 */
export const startAIModerationWorker = async (): Promise<void> => {
	console.log("🤖 Starting AI Moderation Worker...");

	await queueService.consumeQueue(
		QUEUES.AI_MODERATION,
		async (message: any) => {
			try {
				console.log(`📦 Received message:`, JSON.stringify(message, null, 2));

				const { postId, content, authorId } = message;

				console.log(`🔍 Moderating post: ${postId}`);

				const moderationResult = await AIService.moderateContent(content);

				const post = await Post.findById(postId);
				if (!post) {
					console.error(`❌ Post not found: ${postId}`);
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
					console.log(
						`🚫 Post ${postId} rejected by AI: ${moderationResult.reasoning}`,
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
				} else if (moderationResult.recommendation === "review") {
					post.moderationStatus = "flagged";
					console.log(
						`⚠️  Post ${postId} flagged for review: ${moderationResult.reasoning}`,
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
				} else {
					post.moderationStatus = "approved";
					console.log(`✅ Post ${postId} approved by AI`);
				}

				await post.save();

				console.log(
					`✅ Moderation complete for post ${postId}: ${moderationResult.recommendation}`,
				);
			} catch (error: any) {
				console.error("❌ AI Moderation Worker error:", error.message);
				throw error; // Re-throw to trigger retry
			}
		},
		{
			prefetch: 5, // Process up to 5 messages concurrently
		},
	);

	console.log("✅ AI Moderation Worker started");
};

/**
 * Stop AI Moderation Worker
 */
export const stopAIModerationWorker = async (): Promise<void> => {
	console.log("⏹️  Stopping AI Moderation Worker...");
};
