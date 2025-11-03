import { z } from "zod";

// User Management Validation
export const updateUserSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(50, "Name cannot exceed 50 characters")
      .optional(),
    role: z.enum(["Admin", "Moderator", "Member"]).optional(),
    isActive: z.boolean().optional(),
    bio: z
      .string()
      .max(500, "Bio cannot exceed 500 characters")
      .optional(),
  }),
});

export const banUserSchema = z.object({
  body: z.object({
    reason: z
      .string()
      .min(10, "Reason must be at least 10 characters")
      .max(500, "Reason cannot exceed 500 characters"),
    duration: z
      .number()
      .int()
      .positive("Duration must be positive")
      .optional(),
  }),
});

// Report Validation
export const createReportSchema = z.object({
  body: z.object({
    reportedContentType: z.enum(["thread", "post", "user"]),
    reportedContentId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ID"),
    reportType: z.enum([
      "spam",
      "harassment",
      "inappropriate",
      "misinformation",
      "other",
    ]),
    description: z
      .string()
      .min(10, "Description must be at least 10 characters")
      .max(1000, "Description cannot exceed 1000 characters"),
  }),
});

export const reportActionSchema = z.object({
  body: z.object({
    action: z.enum(["resolve", "dismiss"]),
    resolution: z
      .enum(["content_removed", "user_warned", "user_banned", "no_action"])
      .optional(),
    reviewNote: z
      .string()
      .max(500, "Review note cannot exceed 500 characters")
      .optional(),
  }),
});

// System Settings Validation
export const updateSystemSettingsSchema = z.object({
  body: z.object({
    maintenanceMode: z.boolean().optional(),
    registrationEnabled: z.boolean().optional(),
    emailVerificationRequired: z.boolean().optional(),
    maxThreadTitleLength: z
      .number()
      .int()
      .min(50)
      .max(500)
      .optional(),
    maxPostContentLength: z
      .number()
      .int()
      .min(100)
      .max(50000)
      .optional(),
    maxTagsPerThread: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional(),
    allowedFileTypes: z
      .array(z.string())
      .optional(),
    maxFileSize: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional(),
  }),
});
