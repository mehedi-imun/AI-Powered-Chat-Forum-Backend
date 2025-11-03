import { z } from "zod";

// Create thread validation
export const createThreadSchema = z.object({
  body: z.object({
    title: z
      .string({ message: "Title is required" })
      .min(3, "Title must be at least 3 characters")
      .max(200, "Title cannot exceed 200 characters")
      .trim(),
    description: z
      .string()
      .max(500, "Description cannot exceed 500 characters")
      .trim()
      .optional(),
    tags: z
      .array(z.string().trim())
      .max(10, "Cannot have more than 10 tags")
      .optional(),
    initialPostContent: z
      .string({ message: "Initial post content is required" })
      .min(1, "Content must be at least 1 character")
      .max(10000, "Content cannot exceed 10000 characters")
      .trim(),
  }),
});

// Update thread validation
export const updateThreadSchema = z.object({
  body: z.object({
    title: z
      .string()
      .min(3, "Title must be at least 3 characters")
      .max(200, "Title cannot exceed 200 characters")
      .trim()
      .optional(),
    description: z
      .string()
      .max(500, "Description cannot exceed 500 characters")
      .trim()
      .optional(),
    tags: z
      .array(z.string().trim())
      .max(10, "Cannot have more than 10 tags")
      .optional(),
    isPinned: z.boolean().optional(),
    isLocked: z.boolean().optional(),
    status: z.enum(["active", "archived", "deleted"]).optional(),
  }),
});

// Get thread by ID validation
export const getThreadByIdSchema = z.object({
  params: z.object({
    id: z.string({ message: "Thread ID is required" }),
  }),
});

// Query validation for thread list
export const queryThreadSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().trim().optional(),
    tags: z.string().optional(), // Comma-separated tags
    status: z.enum(["active", "archived", "deleted"]).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export type CreateThreadInput = z.infer<typeof createThreadSchema>;
export type UpdateThreadInput = z.infer<typeof updateThreadSchema>;
export type GetThreadByIdInput = z.infer<typeof getThreadByIdSchema>;
export type QueryThreadInput = z.infer<typeof queryThreadSchema>;
