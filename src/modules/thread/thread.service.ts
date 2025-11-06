import logger from "../../utils/logger";
import httpStatus from "http-status";
import { Types } from "mongoose";
import { cacheService } from "../../config/redis";
import { getIO } from "../../config/socket";
import AppError from "../../errors/AppError";
import QueryBuilder from "../../utils/queryBuilder";
import { NotificationService } from "../notification/notification.service";
import { Post } from "../post/post.model";
import type {
  IThread,
  IThreadCreate,
  IThreadQuery,
  IThreadUpdate,
  IThreadWithAuthor,
} from "./thread.interface";
import { Thread } from "./thread.model";

const CACHE_TTL = 300; // 5 minutes
const CACHE_KEY_PREFIX = "thread:";
const CACHE_KEY_LIST = "threads:list";

const invalidateThreadCache = async (threadId?: string): Promise<void> => {
  try {
    await cacheService.del(CACHE_KEY_LIST);

    if (threadId) {
      await cacheService.del(`${CACHE_KEY_PREFIX}${threadId}`);
    }
  } catch (error) {
    logger.error("Cache invalidation error");
  }
};

const createThread = async (
  data: IThreadCreate,
  userId: string
): Promise<IThread> => {
  const { title, description, tags, initialPostContent } = data;
  const thread = await Thread.create({
    title,
    description,
    tags: tags || [],
    createdBy: new Types.ObjectId(userId),
    viewCount: 0,
    postCount: 1, // Initial post counts
    lastActivityAt: new Date(),
    isPinned: false,
    isLocked: false,
    status: "active",
  });

  const initialPost = await Post.create({
    threadId: thread._id,
    content: initialPostContent,
    author: new Types.ObjectId(userId),
    mentions: [],
    status: "active",
    moderationStatus: "pending", // Changed to pending - will be moderated by AI
  });

  const { publishAIModeration } = await import("../../services/queue.service");
  await publishAIModeration({
    postId: initialPost._id?.toString(),
    content: initialPostContent,
    authorId: userId,
  });

  await invalidateThreadCache();

  const populatedThread = await Thread.findById(thread._id).populate(
    "createdBy",
    "name email role avatar"
  );

  try {
    logger.info(
      `🔔 Creating thread notification for user ${userId}, thread ${thread._id}, title: ${thread.title}`
    );
    await NotificationService.createThreadCreatedNotification(
      userId,
      thread._id?.toString(),
      thread.title
    );
    logger.info("✅ Thread notification created successfully");
  } catch (error) {
    logger.error("❌ Failed to create thread notification");
  }

  const io = getIO();
  if (io) {
    io.emit("new-thread", {
      thread: populatedThread,
      timestamp: new Date(),
    });
  }

  return populatedThread as IThread;
};

const getAllThreads = async (
  query: IThreadQuery
): Promise<{
  threads: IThreadWithAuthor[];
  total: number;
  page: number;
  limit: number;
}> => {
  const cacheKey = `${CACHE_KEY_LIST}:${JSON.stringify(query)}`;
  const cached = await cacheService.getJSON(cacheKey);

  if (cached && Object.keys(cached).length > 0) {
    return cached as {
      threads: IThreadWithAuthor[];
      total: number;
      page: number;
      limit: number;
    };
  }

  const searchableFields = ["title", "description"];
  const queryObj = { ...query } as any;
  const queryBuilder = new QueryBuilder(
    Thread.find({ status: { $ne: "deleted" } }).populate(
      "createdBy",
      "name email role"
    ),
    queryObj
  )
    .search(searchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const threads = await queryBuilder.modelQuery;
  const total = await Thread.countDocuments({
    status: { $ne: "deleted" },
    ...(query.search && {
      $or: searchableFields.map((field) => ({
        [field]: { $regex: query.search, $options: "i" },
      })),
    }),
  });

  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;

  const result = {
    threads: threads as IThreadWithAuthor[],
    total,
    page,
    limit,
  };

  await cacheService.setJSON(cacheKey, result, CACHE_TTL);

  return result;
};

const getThreadById = async (id: string): Promise<IThreadWithAuthor> => {
  const cacheKey = `${CACHE_KEY_PREFIX}${id}`;
  const cached = await cacheService.getJSON(cacheKey);

  if (cached && Object.keys(cached).length > 0) {
    return cached as IThreadWithAuthor;
  }

  const thread = await Thread.findOne({
    _id: id,
    status: { $ne: "deleted" },
  }).populate("createdBy", "name email role");

  if (!thread) {
    throw new AppError(httpStatus.NOT_FOUND, "Thread not found");
  }

  Thread.findByIdAndUpdate(id, { $inc: { viewCount: 1 } }).exec();

  await cacheService.setJSON(cacheKey, thread, CACHE_TTL);

  return thread as IThreadWithAuthor;
};

const getThreadBySlug = async (slug: string): Promise<IThreadWithAuthor> => {
  const cacheKey = `${CACHE_KEY_PREFIX}slug:${slug}`;
  const cached = await cacheService.getJSON(cacheKey);

  if (cached && Object.keys(cached).length > 0) {
    return cached as IThreadWithAuthor;
  }

  const thread = await Thread.findOne({
    slug,
    status: { $ne: "deleted" },
  }).populate("createdBy", "name email role");

  if (!thread) {
    throw new AppError(httpStatus.NOT_FOUND, "Thread not found");
  }

  Thread.findByIdAndUpdate(thread._id, { $inc: { viewCount: 1 } }).exec();

  await cacheService.setJSON(cacheKey, thread, CACHE_TTL);

  return thread as IThreadWithAuthor;
};

const updateThread = async (
  id: string,
  data: IThreadUpdate,
  userId: string
): Promise<IThread> => {
  const thread = await Thread.findOne({
    _id: id,
    status: { $ne: "deleted" },
  });

  if (!thread) {
    throw new AppError(httpStatus.NOT_FOUND, "Thread not found");
  }

  if (thread.createdBy.toString() !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to update this thread"
    );
  }

  if (thread.isLocked && !data.isLocked) {
    throw new AppError(httpStatus.BAD_REQUEST, "Thread is locked");
  }

  const updatedThread = await Thread.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  }).populate("createdBy", "name email role avatar");

  if (!updatedThread) {
    throw new AppError(httpStatus.NOT_FOUND, "Thread not found");
  }

  await invalidateThreadCache(id);

  const io = getIO();
  if (io) {
    io.emit("thread-updated", {
      thread: updatedThread,
      timestamp: new Date(),
    });

    io.to(`thread:${id}`).emit("thread-updated", {
      thread: updatedThread,
      timestamp: new Date(),
    });
  }

  return updatedThread;
};

const deleteThread = async (id: string, userId: string): Promise<void> => {
  const thread = await Thread.findOne({
    _id: id,
    status: { $ne: "deleted" },
  });

  if (!thread) {
    throw new AppError(httpStatus.NOT_FOUND, "Thread not found");
  }

  if (thread.createdBy.toString() !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to delete this thread"
    );
  }

  await Thread.findByIdAndUpdate(id, { status: "deleted" });

  await Post.updateMany({ threadId: id }, { status: "deleted" });

  await invalidateThreadCache(id);

  const io = getIO();
  if (io) {
    io.emit("thread-deleted", {
      threadId: id,
      timestamp: new Date(),
    });

    io.to(`thread:${id}`).emit("thread-deleted", {
      threadId: id,
      timestamp: new Date(),
    });
  }
};

const searchThreads = async (
  keyword: string,
  page = 1,
  limit = 10
): Promise<{ threads: IThreadWithAuthor[]; total: number }> => {
  const threads = await Thread.find({
    $text: { $search: keyword },
    status: "active",
  })
    .populate("createdBy", "name email role")
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ score: { $meta: "textScore" } });

  const total = await Thread.countDocuments({
    $text: { $search: keyword },
    status: "active",
  });

  return {
    threads: threads as IThreadWithAuthor[],
    total,
  };
};

const getThreadsByUser = async (
  userId: string,
  page = 1,
  limit = 10
): Promise<{ threads: IThread[]; total: number }> => {
  const threads = await Thread.find({
    createdBy: userId,
    status: { $ne: "deleted" },
  })
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ createdAt: -1 });

  const total = await Thread.countDocuments({
    createdBy: userId,
    status: { $ne: "deleted" },
  });

  return { threads, total };
};

const incrementPostCount = async (threadId: string): Promise<void> => {
  await Thread.findByIdAndUpdate(threadId, {
    $inc: { postCount: 1 },
    lastActivityAt: new Date(),
  });

  await invalidateThreadCache(threadId);
};

const decrementPostCount = async (threadId: string): Promise<void> => {
  await Thread.findByIdAndUpdate(threadId, {
    $inc: { postCount: -1 },
  });

  await invalidateThreadCache(threadId);
};

const requestThreadSummary = async (threadId: string): Promise<void> => {
  const thread = await Thread.findById(threadId);
  if (!thread) {
    throw new AppError(httpStatus.NOT_FOUND, "Thread not found");
  }

  const { publishAISummary } = await import("../../services/queue.service");

  await publishAISummary({
    threadId: threadId.toString(),
  });
};

const getThreadSummary = async (threadId: string): Promise<any | null> => {
  const thread = await Thread.findById(threadId);
  if (!thread) {
    throw new AppError(httpStatus.NOT_FOUND, "Thread not found");
  }

  const cacheKey = `thread:summary:${threadId}`;
  const summary = await cacheService.getJSON(cacheKey);

  return summary || null;
};

export const ThreadService = {
  createThread,
  getAllThreads,
  getThreadById,
  getThreadBySlug,
  updateThread,
  deleteThread,
  searchThreads,
  getThreadsByUser,
  incrementPostCount,
  decrementPostCount,
  requestThreadSummary,
  getThreadSummary,
};
