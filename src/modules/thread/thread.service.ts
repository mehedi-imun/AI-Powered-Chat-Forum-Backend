import httpStatus from "http-status";
import { Types } from "mongoose";
import AppError from "../../errors/AppError";
import { cacheService } from "../../config/redis";
import { getIO } from "../../config/socket";
import QueryBuilder from "../../utils/queryBuilder";
import { Post } from "../post/post.model";
// import { User } from "../user/user.model";
import {
  IThread,
  IThreadCreate,
  IThreadUpdate,
  IThreadQuery,
  IThreadWithAuthor,
} from "./thread.interface";
import { Thread } from "./thread.model";

const CACHE_TTL = 300; // 5 minutes
const CACHE_KEY_PREFIX = "thread:";
const CACHE_KEY_LIST = "threads:list";

// Helper to invalidate cache
const invalidateThreadCache = async (threadId?: string): Promise<void> => {
  try {
    // Invalidate list cache
    await cacheService.del(CACHE_KEY_LIST);

    // Invalidate specific thread cache if ID provided
    if (threadId) {
      await cacheService.del(`${CACHE_KEY_PREFIX}${threadId}`);
    }
  } catch (error) {
    console.error("Cache invalidation error:", error);
    // Don't throw - cache errors shouldn't break the app
  }
};

// Create thread with initial post
const createThread = async (
  data: IThreadCreate,
  userId: string
): Promise<IThread> => {
  const { title, description, tags, initialPostContent } = data;

  // Start a session for transaction
  const session = await Thread.startSession();
  session.startTransaction();

  try {
    // Create thread
    const thread = await Thread.create(
      [
        {
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
        },
      ],
      { session }
    );

    // Create initial post
    await Post.create(
      [
        {
          threadId: thread[0]._id,
          content: initialPostContent,
          author: new Types.ObjectId(userId),
          mentions: [],
          status: "active",
          moderationStatus: "approved",
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // Invalidate cache
    await invalidateThreadCache();

    // Emit Socket.IO event to all clients
    const io = getIO();
    if (io) {
      const populatedThread = await Thread.findById(thread[0]._id).populate(
        "createdBy",
        "name email role avatar"
      );
      
      io.emit("thread:created", {
        thread: populatedThread,
        timestamp: new Date(),
      });
    }

    return thread[0];
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// Get all threads with pagination, search, filter
const getAllThreads = async (
  query: IThreadQuery
): Promise<{ threads: IThreadWithAuthor[]; total: number; page: number; limit: number }> => {
  // Try to get from cache
  const cacheKey = `${CACHE_KEY_LIST}:${JSON.stringify(query)}`;
  const cached = await cacheService.getJSON(cacheKey);

  if (cached && Object.keys(cached).length > 0) {
    return cached as { threads: IThreadWithAuthor[]; total: number; page: number; limit: number };
  }

  const searchableFields = ["title", "description"];
  const queryBuilder = new QueryBuilder(
    Thread.find({ status: { $ne: "deleted" } }).populate("createdBy", "name email role"),
    query as any
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

  // Cache the result
  await cacheService.setJSON(cacheKey, result, CACHE_TTL);

  return result;
};

// Get single thread by ID with metadata
const getThreadById = async (id: string): Promise<IThreadWithAuthor> => {
  // Try cache first
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

  // Increment view count (async, don't wait)
  Thread.findByIdAndUpdate(id, { $inc: { viewCount: 1 } }).exec();

  // Cache the thread
  await cacheService.setJSON(cacheKey, thread, CACHE_TTL);

  return thread as IThreadWithAuthor;
};

// Get thread by slug
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

  // Increment view count
  Thread.findByIdAndUpdate(thread._id, { $inc: { viewCount: 1 } }).exec();

  // Cache the thread
  await cacheService.setJSON(cacheKey, thread, CACHE_TTL);

  return thread as IThreadWithAuthor;
};

// Update thread
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

  // Check if user is the creator
  if (thread.createdBy.toString() !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to update this thread"
    );
  }

  // Check if thread is locked
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

  // Invalidate cache
  await invalidateThreadCache(id);

  // Emit Socket.IO event to thread room and all clients
  const io = getIO();
  if (io) {
    io.emit("thread:updated", {
      thread: updatedThread,
      timestamp: new Date(),
    });
    
    io.to(`thread:${id}`).emit("thread:updated", {
      thread: updatedThread,
      timestamp: new Date(),
    });
  }

  return updatedThread;
};

// Delete thread (soft delete)
const deleteThread = async (id: string, userId: string): Promise<void> => {
  const thread = await Thread.findOne({
    _id: id,
    status: { $ne: "deleted" },
  });

  if (!thread) {
    throw new AppError(httpStatus.NOT_FOUND, "Thread not found");
  }

  // Check if user is the creator
  if (thread.createdBy.toString() !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to delete this thread"
    );
  }

  // Soft delete thread
  await Thread.findByIdAndUpdate(id, { status: "deleted" });

  // Soft delete all posts in this thread
  await Post.updateMany({ threadId: id }, { status: "deleted" });

  // Invalidate cache
  await invalidateThreadCache(id);

  // Emit Socket.IO event to thread room and all clients
  const io = getIO();
  if (io) {
    io.emit("thread:deleted", {
      threadId: id,
      timestamp: new Date(),
    });
    
    io.to(`thread:${id}`).emit("thread:deleted", {
      threadId: id,
      timestamp: new Date(),
    });
  }
};

// Search threads by keyword
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

// Get threads by user
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

// Increment post count (called when a new post is created)
const incrementPostCount = async (threadId: string): Promise<void> => {
  await Thread.findByIdAndUpdate(threadId, {
    $inc: { postCount: 1 },
    lastActivityAt: new Date(),
  });

  // Invalidate cache
  await invalidateThreadCache(threadId);
};

// Decrement post count (called when a post is deleted)
const decrementPostCount = async (threadId: string): Promise<void> => {
  await Thread.findByIdAndUpdate(threadId, {
    $inc: { postCount: -1 },
  });

  // Invalidate cache
  await invalidateThreadCache(threadId);
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
};
