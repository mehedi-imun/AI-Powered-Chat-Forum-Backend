import httpStatus from "http-status";
import { Types } from "mongoose";
import AppError from "../../errors/AppError";
import { QUEUES } from "../../config/rabbitmq";
import { publishNotification, publishAIModeration } from "../../services/queue.service";
import { getIO } from "../../config/socket";
import { NotificationService } from "../notification/notification.service";
import { User } from "../user/user.model";
import { Thread } from "../thread/thread.model";
import { ThreadService } from "../thread/thread.service";
import {
  IPost,
  IPostCreate,
  IPostUpdate,
  IPostWithAuthor,
  IPostQuery,
} from "./post.interface";
import { Post } from "./post.model";

const createPost = async (
  data: IPostCreate,
  userId: string
): Promise<IPost> => {
  const { threadId, parentId, content } = data;

  // Verify thread exists and is not locked
  const thread = await Thread.findOne({
    _id: threadId,
    status: "active",
  });

  if (!thread) {
    throw new AppError(httpStatus.NOT_FOUND, "Thread not found");
  }

  if (thread.isLocked) {
    throw new AppError(httpStatus.BAD_REQUEST, "Thread is locked");
  }

  // If parent post exists, verify it
  if (parentId) {
    const parentPost = await Post.findOne({
      _id: parentId,
      threadId,
      status: "active",
    });

    if (!parentPost) {
      throw new AppError(httpStatus.NOT_FOUND, "Parent post not found");
    }
  }

  const post = await Post.create({
    threadId: new Types.ObjectId(threadId),
    parentId: parentId ? new Types.ObjectId(parentId) : undefined,
    content,
    author: new Types.ObjectId(userId),
    mentions: [],
    status: "active",
    moderationStatus: "approved", // Auto-approve, AI will check async
    isEdited: false,
  });

  // Increment thread post count
  await ThreadService.incrementPostCount(threadId);

  // Extract mentions from content (e.g., @username)
  const mentionMatches = content.match(/@(\w+)/g);
  if (mentionMatches) {
    const usernames = mentionMatches.map((m) => m.substring(1));
    const mentionedUsers = await User.find({
      name: { $in: usernames },
    }).select("_id");

    if (mentionedUsers.length > 0) {
      post.mentions = mentionedUsers.map((u: any) => u._id) as any;
      await post.save();

      for (const mentionedUser of mentionedUsers) {
        // Only notify if not mentioning themselves
        if (mentionedUser._id.toString() !== userId) {
          await NotificationService.createMentionNotification(
            mentionedUser._id.toString(),
            userId,
            post._id!.toString(),
            threadId,
            thread.title
          );
        }

        // Also publish to RabbitMQ for email notifications
        await publishNotification({
          type: "mention",
          userId: mentionedUser._id.toString(),
          postId: post._id!.toString(),
          threadId,
          mentionedBy: userId,
        });
      }
    }
  }

  // If this is a reply to another post, notify the parent post author
  if (parentId) {
    const parentPost = await Post.findById(parentId);
    if (parentPost && parentPost.author.toString() !== userId) {
      await NotificationService.createReplyNotification(
        parentPost.author.toString(),
        userId,
        post._id!.toString(),
        threadId,
        thread.title
      );

      // Also publish to RabbitMQ for email notifications
      await publishNotification({
        type: "reply",
        userId: parentPost.author.toString(),
        postId: post._id!.toString(),
        threadId,
        repliedBy: userId,
      });
    }
  }

  // Publish to AI moderation queue
  await publishAIModeration({
    postId: post._id!.toString(),
    content: post.content,
    authorId: userId,
  });

  // Emit Socket.IO event to thread room
  const io = getIO();
  if (io) {
    const populatedPost = await Post.findById(post._id).populate(
      "author",
      "name email role avatar"
    );
    
    io.to(`thread:${threadId}`).emit("post:created", {
      post: populatedPost,
      threadId,
      parentId: parentId || null,
      timestamp: new Date(),
    });
  }

  return post;
};

const getPostsByThread = async (
  threadId: string,
  page = 1,
  limit = 20
): Promise<{ posts: IPostWithAuthor[]; total: number }> => {
  const posts = await Post.find({
    threadId,
    parentId: null,
    status: "active",
  })
    .populate("author", "name email role")
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ createdAt: 1 }); // Oldest first

  // For each post, get its replies (up to 2 levels deep for performance)
  const postsWithReplies = await Promise.all(
    posts.map(async (post) => {
      const replies = await getPostReplies(post._id!.toString());
      return {
        ...post.toObject(),
        replies,
      } as unknown as IPostWithAuthor;
    })
  );

  const total = await Post.countDocuments({
    threadId,
    parentId: null,
    status: "active",
  });

  return {
    posts: postsWithReplies,
    total,
  };
};

const getPostReplies = async (
  postId: string,
  depth = 0,
  maxDepth = 2
): Promise<IPostWithAuthor[]> => {
  if (depth >= maxDepth) {
    return []; // Stop recursion at maxDepth
  }

  const replies = await Post.find({
    parentId: postId,
    status: "active",
  })
    .populate("author", "name email role")
    .sort({ createdAt: 1 });

  // Recursively get replies for each reply
  const repliesWithNested = await Promise.all(
    replies.map(async (reply) => {
      const nestedReplies = await getPostReplies(
        reply._id!.toString(),
        depth + 1,
        maxDepth
      );
      return {
        ...reply.toObject(),
        replies: nestedReplies,
      } as unknown as IPostWithAuthor;
    })
  );

  return repliesWithNested;
};

const getPostById = async (id: string): Promise<IPostWithAuthor> => {
  const post = await Post.findOne({
    _id: id,
    status: "active",
  }).populate("author", "name email role");

  if (!post) {
    throw new AppError(httpStatus.NOT_FOUND, "Post not found");
  }

  const replies = await getPostReplies(id);

  return {
    ...post.toObject(),
    replies,
  } as unknown as IPostWithAuthor;
};

const updatePost = async (
  id: string,
  data: IPostUpdate,
  userId: string
): Promise<IPost> => {
  const post = await Post.findOne({
    _id: id,
    status: "active",
  });

  if (!post) {
    throw new AppError(httpStatus.NOT_FOUND, "Post not found");
  }

  // Check if user is the author
  if (post.author.toString() !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to update this post"
    );
  }

  // Check if thread is locked
  const thread = await Thread.findById(post.threadId);
  if (thread?.isLocked) {
    throw new AppError(httpStatus.BAD_REQUEST, "Thread is locked");
  }

  post.content = data.content;
  post.isEdited = true;
  post.editedAt = new Date();
  await post.save();

  // Re-run AI moderation on edited content
  await publishAIModeration({
    postId: post._id!.toString(),
    content: post.content,
    authorId: userId,
  });

  // Emit Socket.IO event to thread room
  const io = getIO();
  if (io) {
    const populatedPost = await Post.findById(post._id).populate(
      "author",
      "name email role avatar"
    );
    
    io.to(`thread:${post.threadId.toString()}`).emit("post:updated", {
      post: populatedPost,
      threadId: post.threadId.toString(),
      timestamp: new Date(),
    });
  }

  return post;
};

const deletePost = async (id: string, userId: string): Promise<void> => {
  const post = await Post.findOne({
    _id: id,
    status: "active",
  });

  if (!post) {
    throw new AppError(httpStatus.NOT_FOUND, "Post not found");
  }

  // Check if user is the author
  if (post.author.toString() !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to delete this post"
    );
  }

  // Store threadId before deletion for socket emit
  const threadId = post.threadId.toString();
  const postId = post._id!.toString();

  // Soft delete post
  post.status = "deleted";
  await post.save();

  // Decrement thread post count
  await ThreadService.decrementPostCount(threadId);

  // Soft delete all replies (recursive)
  await deletePostReplies(id);

  // Emit Socket.IO event to thread room
  const io = getIO();
  if (io) {
    io.to(`thread:${threadId}`).emit("post:deleted", {
      postId,
      threadId,
      timestamp: new Date(),
    });
  }
};

// Helper to delete all replies recursively
const deletePostReplies = async (postId: string): Promise<void> => {
  const replies = await Post.find({ parentId: postId, status: "active" });

  for (const reply of replies) {
    reply.status = "deleted";
    await reply.save();

    // Decrement count
    await ThreadService.decrementPostCount(reply.threadId.toString());

    // Recursively delete nested replies
    await deletePostReplies(reply._id!.toString());
  }
};

const getPostsByUser = async (
  userId: string,
  page = 1,
  limit = 20
): Promise<{ posts: IPostWithAuthor[]; total: number }> => {
  const posts = await Post.find({
    author: userId,
    status: "active",
  })
    .populate("author", "name email role")
    .populate("threadId", "title slug")
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ createdAt: -1 });

  const total = await Post.countDocuments({
    author: userId,
    status: "active",
  });

  return {
    posts: posts as unknown as IPostWithAuthor[],
    total,
  };
};

const getFlaggedPosts = async (
  page = 1,
  limit = 20
): Promise<{ posts: IPostWithAuthor[]; total: number }> => {
  const posts = await Post.find({
    moderationStatus: "flagged",
    status: "active",
  })
    .populate("author", "name email role")
    .populate("threadId", "title slug")
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ createdAt: -1 });

  const total = await Post.countDocuments({
    moderationStatus: "flagged",
    status: "active",
  });

  return {
    posts: posts as unknown as IPostWithAuthor[],
    total,
  };
};

export const PostService = {
  createPost,
  getPostsByThread,
  getPostReplies,
  getPostById,
  updatePost,
  deletePost,
  getPostsByUser,
  getFlaggedPosts,
};
