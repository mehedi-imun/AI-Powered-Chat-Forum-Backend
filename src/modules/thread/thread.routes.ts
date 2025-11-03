import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { validateRequest } from "../../middleware/validateRequest";
import { ThreadController } from "./thread.controller";
import {
  createThreadSchema,
  updateThreadSchema,
  getThreadByIdSchema,
  queryThreadSchema,
} from "./thread.validation";

const router = Router();

router.get("/", validateRequest(queryThreadSchema), ThreadController.getAllThreads);
router.get("/search", ThreadController.searchThreads);
router.get("/slug/:slug", ThreadController.getThreadBySlug);
router.get("/user/:userId", ThreadController.getThreadsByUser);
router.get("/:id", validateRequest(getThreadByIdSchema), ThreadController.getThreadById);

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

router.post(
  "/:id/summary",
  authenticate,
  validateRequest(getThreadByIdSchema),
  ThreadController.requestThreadSummary
);

router.get(
  "/:id/summary",
  validateRequest(getThreadByIdSchema),
  ThreadController.getThreadSummary
);

export const ThreadRoutes = router;
