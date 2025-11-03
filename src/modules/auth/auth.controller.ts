import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import env from "../../config/env";
import sendResponse from "../../utils/sendResponse";
import { AuthService } from "./auth.service";

// Login
const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const result = await AuthService.login(email, password);

    // Set HTTP-only cookies
    res.cookie("accessToken", result.accessToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Login successful",
      data: {
        user: result.user,
        mustChangePassword: result.mustChangePassword, // Include at top level
      },
    });
  } catch (error) {
    next(error);
  }
};

// Logout
const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await AuthService.logout();

    // Clear cookies
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Logout successful",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

// Refresh token
const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return sendResponse(res, {
        statusCode: httpStatus.UNAUTHORIZED,
        success: false,
        message: "No refresh token provided",
        data: null,
      });
    }

    const result = await AuthService.refreshAccessToken(refreshToken);

    // Set new access token cookie
    res.cookie("accessToken", result.accessToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Token refreshed successfully",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

// Forgot password
const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;
    const resetToken = await AuthService.forgotPassword(email);

    // In production, this would send an email
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message:
        "If an account with that email exists, a password reset link has been sent",
      data: env.NODE_ENV === "development" ? { resetToken } : null, // Only in dev
    });
  } catch (error) {
    next(error);
  }
};

// Reset password
const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token, password } = req.body;
    await AuthService.resetPassword(token, password);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Password reset successful",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

// Get current user (me)
const getMe = async (req: any, res: Response, next: NextFunction) => {
  try {
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "User retrieved successfully",
      data: req.user,
    });
  } catch (error) {
    next(error);
  }
};

// Self-service registration
const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, organizationName, organizationSlug } =
      req.body;

    const result = await AuthService.register({
      name,
      email,
      password,
      organizationName,
      organizationSlug,
    });

    // Set HTTP-only cookies for auto-login
    res.cookie("accessToken", result.accessToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Registration successful",
      data: {
        user: result.user,
        organization: result.organization,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Setup organization (admin-created)
const setupOrganization = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token, name, password } = req.body;

    const result = await AuthService.setupOrganization({
      token,
      name,
      password,
    });

    // Set HTTP-only cookies for auto-login
    res.cookie("accessToken", result.accessToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Organization setup successful",
      data: {
        user: result.user,
        organization: result.organization,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Change password (regular)
const changePassword = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    const result = await AuthService.changePassword(
      userId,
      currentPassword,
      newPassword
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: result.message,
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

// Force change password (first login)
const forceChangePassword = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { newPassword } = req.body;
    const userId = req.user._id;

    const result = await AuthService.forceChangePassword(userId, newPassword);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: result.message,
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

// Verify email
const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return sendResponse(res, {
        statusCode: 400,
        success: false,
        message: "Verification token is required",
        data: null,
      });
    }

    const result = await AuthService.verifyEmail(token);

    // Set tokens as cookies
    if (result.accessToken && result.refreshToken) {
      res.cookie("accessToken", result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
    }

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: result.message,
      data: result.user,
    });
  } catch (error) {
    next(error);
  }
};

// Resend verification email
const resendVerificationEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendResponse(res, {
        statusCode: 400,
        success: false,
        message: "Email is required",
        data: null,
      });
    }

    await AuthService.resendVerificationEmail(email);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Verification email sent successfully. Please check your inbox.",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

// Setup account for invited team member
const setupAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token, password } = req.body;

    const result = await AuthService.setupAccount({ token, password });

    // Set HTTP-only cookies for auto-login
    res.cookie("accessToken", result.accessToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: result.message,
      data: {
        user: result.user,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Validate setup token
const validateSetupToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return sendResponse(res, {
        statusCode: 400,
        success: false,
        message: "Setup token is required",
        data: null,
      });
    }

    const result = await AuthService.validateSetupToken(token);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Token is valid",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const AuthController = {
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  getMe,
  register,
  setupOrganization,
  changePassword,
  forceChangePassword,
  verifyEmail,
  resendVerificationEmail,
  setupAccount,
  validateSetupToken,
};
