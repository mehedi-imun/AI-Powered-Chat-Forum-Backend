import express from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateRequest } from "../../middleware/validateRequest";
import { UserController } from "./user.controller";
import {
  changePasswordSchema,
  createUserSchema,
  updateUserSchema,
} from "./user.validation";

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

// Get all users (SuperAdmin/Admin only)
router.get("/", authorize("SuperAdmin", "Admin"), UserController.getAllUsers);

// Get single user
router.get("/:userId", UserController.getUserById);

// Create user (SuperAdmin/Admin only)
router.post(
  "/",
  authorize("SuperAdmin", "Admin"),
  validateRequest(createUserSchema),
  UserController.createUser
);

// Update user role (SuperAdmin/Admin only)
router.patch(
  "/:userId/role",
  authorize("SuperAdmin", "Admin"),
  UserController.updateUserRole
);

// Update user status (SuperAdmin/Admin only)
router.patch(
  "/:userId/status",
  authorize("SuperAdmin", "Admin"),
  UserController.updateUserStatus
);

// Update user (SuperAdmin/Admin only)
router.patch(
  "/:userId",
  authorize("SuperAdmin", "Admin"),
  validateRequest(updateUserSchema),
  UserController.updateUser
);

// Delete user (SuperAdmin/Admin only)
router.delete(
  "/:userId",
  authorize("SuperAdmin", "Admin"),
  UserController.deleteUser
);

// Toggle user status (SuperAdmin/Admin only)
router.patch(
  "/:userId/toggle-status",
  authorize("SuperAdmin", "Admin"),
  UserController.toggleUserStatus
);

// Change own password (any authenticated user)
router.patch(
  "/me/change-password",
  validateRequest(changePasswordSchema),
  UserController.changePassword
);

export const UserRoutes = router;
