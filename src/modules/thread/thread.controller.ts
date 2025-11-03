import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { ThreadService } from "./thread.service";

// Create thread
const createThread = catchAsync(async (req, res) => {
  const userId = req.user?.userId;
  const thread = await ThreadService.createThread(req.body, userId!);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Thread created successfully",
    data: thread,
  });
});

// Get all threads
const getAllThreads = catchAsync(async (req, res) => {
  const result = await ThreadService.getAllThreads(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Threads retrieved successfully",
    data: result,
  });
});

// Get thread by ID
const getThreadById = catchAsync(async (req, res) => {
  const thread = await ThreadService.getThreadById(req.params.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Thread retrieved successfully",
    data: thread,
  });
});

// Get thread by slug
const getThreadBySlug = catchAsync(async (req, res) => {
  const thread = await ThreadService.getThreadBySlug(req.params.slug);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Thread retrieved successfully",
    data: thread,
  });
});

// Update thread
const updateThread = catchAsync(async (req, res) => {
  const userId = req.user?.userId;
  const thread = await ThreadService.updateThread(
    req.params.id,
    req.body,
    userId!
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Thread updated successfully",
    data: thread,
  });
});

// Delete thread
const deleteThread = catchAsync(async (req, res) => {
  const userId = req.user?.userId;
  await ThreadService.deleteThread(req.params.id, userId!);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Thread deleted successfully",
    data: null,
  });
});

// Search threads
const searchThreads = catchAsync(async (req, res) => {
  const { keyword, page, limit } = req.query;
  const result = await ThreadService.searchThreads(
    keyword as string,
    Number(page) || 1,
    Number(limit) || 10
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Threads search completed",
    data: result,
  });
});

// Get threads by user
const getThreadsByUser = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const { page, limit } = req.query;
  const result = await ThreadService.getThreadsByUser(
    userId,
    Number(page) || 1,
    Number(limit) || 10
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User threads retrieved successfully",
    data: result,
  });
});

export const ThreadController = {
  createThread,
  getAllThreads,
  getThreadById,
  getThreadBySlug,
  updateThread,
  deleteThread,
  searchThreads,
  getThreadsByUser,
};
