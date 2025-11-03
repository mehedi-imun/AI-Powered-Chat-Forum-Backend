import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { PostService } from "./post.service";

const createPost = catchAsync(async (req, res) => {
  const userId = req.user?.userId;
  const post = await PostService.createPost(req.body, userId!);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Post created successfully",
    data: post,
  });
});

const getPostsByThread = catchAsync(async (req, res) => {
  const { threadId } = req.params;
  const { page, limit } = req.query;
  const result = await PostService.getPostsByThread(
    threadId,
    Number(page) || 1,
    Number(limit) || 20
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Posts retrieved successfully",
    data: result,
  });
});

const getPostById = catchAsync(async (req, res) => {
  const post = await PostService.getPostById(req.params.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Post retrieved successfully",
    data: post,
  });
});

const updatePost = catchAsync(async (req, res) => {
  const userId = req.user?.userId;
  const post = await PostService.updatePost(req.params.id, req.body, userId!);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Post updated successfully",
    data: post,
  });
});

const deletePost = catchAsync(async (req, res) => {
  const userId = req.user?.userId;
  await PostService.deletePost(req.params.id, userId!);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Post deleted successfully",
    data: null,
  });
});

const getPostsByUser = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const { page, limit } = req.query;
  const result = await PostService.getPostsByUser(
    userId,
    Number(page) || 1,
    Number(limit) || 20
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User posts retrieved successfully",
    data: result,
  });
});

const getFlaggedPosts = catchAsync(async (req, res) => {
  const { page, limit } = req.query;
  const result = await PostService.getFlaggedPosts(
    Number(page) || 1,
    Number(limit) || 20
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Flagged posts retrieved successfully",
    data: result,
  });
});

export const PostController = {
  createPost,
  getPostsByThread,
  getPostById,
  updatePost,
  deletePost,
  getPostsByUser,
  getFlaggedPosts,
};
