import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { ThreadService } from "./thread.service";

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

const getAllThreads = catchAsync(async (req, res) => {
  const result = await ThreadService.getAllThreads(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Threads retrieved successfully",
    data: result,
  });
});

const getThreadById = catchAsync(async (req, res) => {
  const thread = await ThreadService.getThreadById(req.params.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Thread retrieved successfully",
    data: thread,
  });
});

const getThreadBySlug = catchAsync(async (req, res) => {
  const thread = await ThreadService.getThreadBySlug(req.params.slug);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Thread retrieved successfully",
    data: thread,
  });
});

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

// Request thread summary
const requestThreadSummary = catchAsync(async (req, res) => {
  const { id } = req.params;
  await ThreadService.requestThreadSummary(id);

  sendResponse(res, {
    statusCode: httpStatus.ACCEPTED,
    success: true,
    message: "Thread summary generation requested. Check back in a moment.",
    data: null,
  });
});

const getThreadSummary = catchAsync(async (req, res) => {
  const { id } = req.params;
  const summary = await ThreadService.getThreadSummary(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: summary
      ? "Thread summary retrieved successfully"
      : "Summary not yet available. Request one first.",
    data: summary,
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
  requestThreadSummary,
  getThreadSummary,
};
