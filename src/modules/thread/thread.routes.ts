import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import validateRequest from "../../middleware/validateRequest";
import { ThreadController } from "./thread.controller";
import {
  createThreadSchema,
  updateThreadSchema,
  getThreadByIdSchema,
  queryThreadSchema,
} from "./thread.validation";

const router = Router();

// Public routes (no authentication required for reading)
router.get("/", validateRequest(queryThreadSchema), ThreadController.getAllThreads);
router.get("/search", ThreadController.searchThreads);
router.get("/slug/:slug", ThreadController.getThreadBySlug);
router.get("/user/:userId", ThreadController.getThreadsByUser);
router.get("/:id", validateRequest(getThreadByIdSchema), ThreadController.getThreadById);

// Protected routes (authentication required)
router.post(
  "/",
  authenticate,
  validateRequest(createThreadSchema),
  ThreadController.createThread
);

router.patch(
  "/:id",
  authenticate,
  validateRequest(getThreadByIdSchema),
  validateRequest(updateThreadSchema),
  ThreadController.updateThread
);

router.delete(
  "/:id",
  authenticate,
  validateRequest(getThreadByIdSchema),
  ThreadController.deleteThread
);

export const ThreadRoutes = router;
