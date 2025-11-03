import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateRequest } from "../../middleware/validateRequest";
import { UserController } from "./user.controller";
import { updateUserSchema } from "./user.validation";

const router = Router();

router.get("/", UserController.getAllUsers);
router.get("/:id", UserController.getUserById);

router.patch(
	"/me",
	authenticate,
	validateRequest(updateUserSchema),
	UserController.updateUser,
);

router.delete(
	"/:id",
	authenticate,
	authorize("Admin"),
	UserController.deleteUser,
);

export const UserRoutes = router;
