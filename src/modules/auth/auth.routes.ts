import express from "express";
import { authenticate } from "../../middleware/authenticate";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import {
  changePasswordSchema,
  forceChangePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationEmailSchema,
  resetPasswordSchema,
  setupAccountSchema,
  setupOrganizationSchema,
} from "./auth.validation";

const router = express.Router();

// Public routes
router.post("/login", validateRequest(loginSchema), AuthController.login);
router.post(
  "/register",
  validateRequest(registerSchema),
  AuthController.register
);
router.post(
  "/setup-organization",
  validateRequest(setupOrganizationSchema),
  AuthController.setupOrganization
);
router.post("/logout", AuthController.logout);
router.post("/refresh-token", AuthController.refreshToken);
router.post(
  "/forgot-password",
  validateRequest(forgotPasswordSchema),
  AuthController.forgotPassword
);
router.post(
  "/reset-password",
  validateRequest(resetPasswordSchema),
  AuthController.resetPassword
);
router.get("/verify-email", AuthController.verifyEmail);
router.post(
  "/resend-verification",
  validateRequest(resendVerificationEmailSchema),
  AuthController.resendVerificationEmail
);
router.post(
  "/setup-account",
  validateRequest(setupAccountSchema),
  AuthController.setupAccount
);
router.get("/validate-setup-token", AuthController.validateSetupToken);

// Protected routes
router.get("/me", authenticate, AuthController.getMe);
router.post(
  "/change-password",
  authenticate,
  validateRequest(changePasswordSchema),
  AuthController.changePassword
);
router.post(
  "/force-change-password",
  authenticate,
  validateRequest(forceChangePasswordSchema),
  AuthController.forceChangePassword
);

export const AuthRoutes = router;
