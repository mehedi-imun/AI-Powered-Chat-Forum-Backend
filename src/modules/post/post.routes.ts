import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateRequest } from "../../middleware/validateRequest";
import { PostController } from "./post.controller";
import {
  createPostSchema,
  updatePostSchema,
  getPostByIdSchema,
} from "./post.validation";

const router = Router();

router.get("/thread/:threadId", PostController.getPostsByThread);
router.get("/user/:userId", PostController.getPostsByUser);
router.get("/:id", validateRequest(getPostByIdSchema), PostController.getPostById);

router.post(
  "/",
  authenticate,
  validateRequest(createPostSchema),
  PostController.createPost
);

router.patch(
  "/:id",
  authenticate,
  validateRequest(getPostByIdSchema),
  validateRequest(updatePostSchema),
  PostController.updatePost
);

router.delete(
  "/:id",
  authenticate,
  validateRequest(getPostByIdSchema),
  PostController.deletePost
);

router.get(
  "/flagged/all",
  authenticate,
  authorize("Admin"),
  PostController.getFlaggedPosts
);

export const PostRoutes = router;
