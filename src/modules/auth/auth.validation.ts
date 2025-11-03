import { z } from "zod";

const registerSchema = z.object({
  body: z.object({
    name: z.string({ message: "Name is required" }).min(2, "Name must be at least 2 characters"),
    email: z.string({ message: "Email is required" }).email("Invalid email format"),
    password: z.string({ message: "Password is required" }).min(6, "Password must be at least 6 characters"),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string({ message: "Email is required" }).email("Invalid email format"),
    password: z.string({ message: "Password is required" }),
  }),
});

const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string({ message: "Refresh token is required" }),
  }),
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string({ message: "Email is required" }).email("Invalid email format"),
  }),
});

const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string({ message: "Reset token is required" }),
    newPassword: z.string({ message: "New password is required" }).min(6, "Password must be at least 6 characters"),
  }),
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string({ message: "Current password is required" }),
    newPassword: z.string({ message: "New password is required" }).min(6, "Password must be at least 6 characters"),
  }),
});

export const AuthValidation = {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
};
