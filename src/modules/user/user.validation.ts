import { z } from "zod";

// User roles enum - NEW 5-role system
export const UserRoleEnum = z.enum([
  "SuperAdmin",
  "Admin",
  "OrgOwner",
  "OrgAdmin",
  "OrgMember",
]);

// Create user schema
export const createUserSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(100, "Password too long"),
    name: z.string().min(1, "Name is required").max(100, "Name too long"),
    role: UserRoleEnum,
    organizationId: z.string().optional(), // Optional for platform admins
  }),
});

// Update user schema
export const updateUserSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    role: UserRoleEnum.optional(),
    isActive: z.boolean().optional(),
  }),
});

// Login schema
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(1, "Password is required"),
  }),
});

// Change password schema
export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(6, "New password must be at least 6 characters")
      .max(100, "Password too long"),
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
