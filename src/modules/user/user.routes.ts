import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateRequest } from "../../middleware/validateRequest";
import { UserController } from "./user.controller";
import { updateUserSchema } from "./user.validation";

const router = Router();

// Public routes
router.get("/", UserController.getAllUsers);
router.get("/:id", UserController.getUserById);

// Protected routes
router.patch(
  "/me",
  authenticate,
  validateRequest(updateUserSchema),
  UserController.updateUser
);

// Admin routes
router.delete("/:id", authenticate, authorize("Admin"), UserController.deleteUser);

export const UserRoutes = router;
