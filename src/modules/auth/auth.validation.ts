import { z } from "zod";

// Login schema
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(1, "Password is required"),
  }),
});

// Forgot password schema
export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
  }),
});

// Reset password schema
export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Reset token is required"),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(100, "Password too long"),
  }),
});

// Refresh token schema
export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  }),
});

// Self-service registration schema
export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email format"),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(100, "Password too long"),
    organizationName: z.string().min(2, "Organization name is required"),
    organizationSlug: z
      .string()
      .min(2, "Organization slug is required")
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must be lowercase letters, numbers, and hyphens only"
      ),
  }),
});

// Organization setup schema (admin-created orgs)
export const setupOrganizationSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Setup token is required"),
    name: z.string().min(2, "Name must be at least 2 characters"),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(100, "Password too long"),
  }),
});

// Change password schema (regular)
export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(100, "Password too long")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/,
        "Password must include uppercase, lowercase, number, and special character"
      ),
  }),
});

// Force change password schema (first login)
export const forceChangePasswordSchema = z.object({
  body: z.object({
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(100, "Password too long")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/,
        "Password must include uppercase, lowercase, number, and special character"
      ),
  }),
});

// Resend verification email schema
export const resendVerificationEmailSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
  }),
});

// Setup account schema (for invited team members)
export const setupAccountSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Setup token is required"),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(100, "Password too long"),
  }),
});
