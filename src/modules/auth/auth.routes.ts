import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import { AuthValidation } from "./auth.validation";

const router = Router();

router.post(
  "/register",
  validateRequest(AuthValidation.registerSchema),
  AuthController.register
);

router.post(
  "/login",
  validateRequest(AuthValidation.loginSchema),
  AuthController.login
);

router.post(
  "/refresh-token",
  validateRequest(AuthValidation.refreshTokenSchema),
  AuthController.refreshToken
);

router.post(
  "/forgot-password",
  validateRequest(AuthValidation.forgotPasswordSchema),
  AuthController.forgotPassword
);

router.post(
  "/reset-password",
  validateRequest(AuthValidation.resetPasswordSchema),
  AuthController.resetPassword
);

router.get("/verify-email/:token", AuthController.verifyEmail);

router.post(
  "/change-password",
  authenticate,
  validateRequest(AuthValidation.changePasswordSchema),
  AuthController.changePassword
);

export const AuthRoutes = router;
