import { QUEUES } from "../config/rabbitmq";
import { NotificationService } from "../modules/notification/notification.service";
import { webhookService } from "../modules/webhook/webhook.service";
import { Thread } from "../modules/thread/thread.model";
import { User } from "../modules/user/user.model";
import { queueService } from "../services/queue.service";

interface NotificationJob {
	type: "mention" | "reply" | "thread_comment" | "post_like" | "follow";
	userId: string;
	postId?: string;
	threadId?: string;
	mentionedBy?: string;
	repliedBy?: string;
	commentedBy?: string;
	likedBy?: string;
	followedBy?: string;
}

/**
 * Notification Worker
 * Processes notification jobs from the queue
 * Sends real-time notifications via Socket.IO and persists to database
 */
export const startNotificationWorker = async (): Promise<void> => {
	console.log("🔔 Starting Notification Worker...");

	await queueService.consumeQueue(
		QUEUES.NOTIFICATIONS,
		async (message: NotificationJob) => {
			try {
				console.log(`📦 Received notification job:`, JSON.stringify(message, null, 2));

				const { type, userId, postId, threadId } = message;

				// Get thread info if available
				let threadTitle = "Unknown Thread";
				if (threadId) {
					const thread = await Thread.findById(threadId);
					if (thread) {
						threadTitle = thread.title;
					}
				}

				// Get user info for the actor
				let actorName = "Someone";
				let actorId: string | undefined;

				if (message.mentionedBy) {
					actorId = message.mentionedBy;
				} else if (message.repliedBy) {
					actorId = message.repliedBy;
				} else if (message.commentedBy) {
					actorId = message.commentedBy;
				} else if (message.likedBy) {
					actorId = message.likedBy;
				} else if (message.followedBy) {
					actorId = message.followedBy;
				}

				if (actorId) {
					const actor = await User.findById(actorId);
					if (actor) {
						actorName = actor.name;
					}
				}

				// Create notification based on type
				switch (type) {
					case "mention":
						if (threadId && postId) {
							await NotificationService.createMentionNotification(
								userId,
								message.mentionedBy!,
								postId,
								threadId,
								threadTitle,
							);
							// Trigger external webhooks
							await webhookService.triggerExternalWebhooks("notification.sent", {
								type: "mention",
								userId,
								postId,
								threadId,
								mentionedBy: message.mentionedBy,
								timestamp: new Date(),
							});
						}
						break;

					case "reply":
						if (threadId && postId) {
							await NotificationService.createReplyNotification(
								userId,
								message.repliedBy!,
								postId,
								threadId,
								threadTitle,
							);
							// Trigger external webhooks
							await webhookService.triggerExternalWebhooks("notification.sent", {
								type: "reply",
								userId,
								postId,
								threadId,
								repliedBy: message.repliedBy,
								timestamp: new Date(),
							});
						}
						break;

					case "thread_comment":
						if (threadId && postId) {
							await NotificationService.createNotification({
								userId,
								type: "thread_comment",
								title: "New comment on your thread",
								message: `${actorName} commented on your thread "${threadTitle}"`,
								link: `/threads/${threadId}#post-${postId}`,
								relatedUserId: message.commentedBy,
								relatedThreadId: threadId,
								relatedPostId: postId,
							});
							// Trigger external webhooks
							await webhookService.triggerExternalWebhooks("notification.sent", {
								type: "thread_comment",
								userId,
								postId,
								threadId,
								commentedBy: message.commentedBy,
								timestamp: new Date(),
							});
						}
						break;

					case "post_like":
						if (threadId && postId) {
							await NotificationService.createNotification({
								userId,
								type: "post_like",
								title: "Someone liked your post",
								message: `${actorName} liked your post in "${threadTitle}"`,
								link: `/threads/${threadId}#post-${postId}`,
								relatedUserId: message.likedBy,
								relatedThreadId: threadId,
								relatedPostId: postId,
							});
							// Trigger external webhooks
							await webhookService.triggerExternalWebhooks("notification.sent", {
								type: "post_like",
								userId,
								postId,
								threadId,
								likedBy: message.likedBy,
								timestamp: new Date(),
							});
						}
						break;

					case "follow":
						await NotificationService.createNotification({
							userId,
							type: "follow",
							title: "New follower",
							message: `${actorName} started following you`,
							link: `/profile/${message.followedBy}`,
							relatedUserId: message.followedBy,
						});
						// Trigger external webhooks
						await webhookService.triggerExternalWebhooks("notification.sent", {
							type: "follow",
							userId,
							followedBy: message.followedBy,
							timestamp: new Date(),
						});
						break;

					default:
						console.warn(`⚠️  Unknown notification type: ${type}`);
				}

				console.log(`✅ Notification processed: ${type} for user ${userId}`);
			} catch (error: any) {
				console.error("❌ Notification Worker error:", error.message);
				throw error; // Re-throw to trigger retry
			}
		},
		{
			prefetch: 10, // Process up to 10 notifications concurrently
		},
	);

	console.log("✅ Notification Worker started");
};

/**
 * Stop Notification Worker
 */
export const stopNotificationWorker = async (): Promise<void> => {
	console.log("⏹️  Stopping Notification Worker...");
};
