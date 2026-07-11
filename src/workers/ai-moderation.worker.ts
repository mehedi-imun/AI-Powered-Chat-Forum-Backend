import { Types } from "mongoose";
import { QUEUES } from "../config/rabbitmq";
import { cacheService } from "../config/redis";
import { Report } from "../modules/admin/admin.model";
import { NotificationService } from "../modules/notification/notification.service";
import { Post } from "../modules/post/post.model";
import { Thread } from "../modules/thread/thread.model";
import { AIService, type IModerationResult } from "../services/ai.service";
import {
	type AIModerationQueueData,
	queueService,
} from "../services/queue.service";
import { checkContentLocally, hashContent } from "../utils/content-filter";
import logger from "../utils/logger";

export const startAIModerationWorker = async (): Promise<void> => {
	logger.info("Starting AI Moderation Worker...");

	await queueService.consumeQueue(
		QUEUES.AI_MODERATION,
		async (message: AIModerationQueueData) => {
			try {
				logger.info(`Received message: ${JSON.stringify(message, null, 2)}`);

				const { postId, content, authorId } = message;

				logger.info(`Moderating post: ${postId}`);

				// Stage A — local filter: skip API for obvious cases
				const localResult = checkContentLocally(content);

				if (localResult === "approve") {
					const post = await Post.findById(postId);
					if (!post) {
						logger.error(`Post not found: ${postId}`);
						return;
					}
					post.moderationStatus = "approved";
					post.aiScore = { spam: 0.05, toxicity: 0.05, inappropriate: 0.05 };
					post.aiReasoning =
						"Auto-approved: content too short or clearly clean";
					post.aiRecommendation = "approve";
					await post.save();
					logger.info(`Post ${postId} auto-approved by local filter`);
					return;
				}

				if (localResult === "reject") {
					const post = await Post.findById(postId);
					if (!post) {
						logger.error(`Post not found: ${postId}`);
						return;
					}
					post.moderationStatus = "rejected";
					post.status = "deleted";
					post.aiScore = { spam: 0.95, toxicity: 0.95, inappropriate: 0.95 };
					post.aiReasoning = "Auto-rejected: matched local toxic/spam pattern";
					post.aiRecommendation = "reject";
					await post.save();

					await Report.create({
						reportedContentType: "post",
						reportedContentId: new Types.ObjectId(postId),
						reportType: "harassment",
						description: `AI Moderation (Local Filter): ${post.aiReasoning}`,
						reportedBy: new Types.ObjectId(authorId),
						status: "reviewing",
					});

					const thread = await Thread.findById(post.threadId);
					if (thread) {
						await NotificationService.createAIModerationRejectedNotification(
							authorId,
							postId,
							post.threadId.toString(),
							thread.title,
							post.aiReasoning,
						);
					}

					logger.info(`Post ${postId} auto-rejected by local filter`);
					return;
				}

				// Stage B — hash dedup: return cached result if same content was moderated before
				const contentHash = hashContent(content);
				const cacheKey = `ai:moderation:result:${contentHash}`;
				const cached = await cacheService.getJSON<IModerationResult>(cacheKey);

				let moderationResult: IModerationResult;
				if (cached) {
					moderationResult = cached;
					logger.info(`Post ${postId} moderation result served from cache`);
				} else {
					moderationResult = await AIService.moderateContent(content);
					await cacheService.setJSON(cacheKey, moderationResult, 86400);
				}

				const post = await Post.findById(postId);
				if (!post) {
					logger.error(`Post not found: ${postId}`);
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
						` Post ${postId} rejected by AI: ${moderationResult.reasoning}`,
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
							moderationResult.reasoning,
						);
					}
				} else if (moderationResult.recommendation === "review") {
					post.moderationStatus = "flagged";
					logger.info(
						`Post ${postId} flagged for review: ${moderationResult.reasoning}`,
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
							moderationResult.reasoning,
						);
					}
				} else {
					post.moderationStatus = "approved";
					logger.info(`Post ${postId} approved by AI`);
				}

				await post.save();

				logger.info(
					`Moderation complete for post ${postId}: ${moderationResult.recommendation}`,
				);
			} catch (error) {
				const _errorMessage =
					error instanceof Error ? error.message : "Unknown error";
				logger.error("AI Moderation Worker error");
				throw error;
			}
		},
		{
			prefetch: 5,
		},
	);

	logger.info("AI Moderation Worker started");
};

export const stopAIModerationWorker = async (): Promise<void> => {
	logger.info("Stopping AI Moderation Worker...");
};
