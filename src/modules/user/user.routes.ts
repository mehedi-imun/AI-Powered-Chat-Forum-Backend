import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { authorizeOwnProfile } from "../../middleware/authorizeOwnership";
import { validateRequest } from "../../middleware/validateRequest";
import { UserController } from "./user.controller";
import { updateUserSchema } from "./user.validation";
import { User } from "./user.model";

const router = Router();

router.get("/", UserController.getAllUsers);

// Get current user (must be before /:id to avoid conflict)
router.get("/me", authenticate, UserController.getCurrentUser);

router.get("/:id", UserController.getUserById);

// Update own profile
router.patch(
	"/me",
	authenticate,
	validateRequest(updateUserSchema),
	UserController.updateUser,
);

// Update any user profile (Admin only or own profile)
router.patch(
	"/:id",
	authenticate,
	authorizeOwnProfile,
	validateRequest(updateUserSchema),
	UserController.updateUser,
);

// Delete user (Admin only)
router.delete(
	"/:id",
	authenticate,
	authorize("Admin"),
	UserController.deleteUser,
);

export const UserRoutes = router;
