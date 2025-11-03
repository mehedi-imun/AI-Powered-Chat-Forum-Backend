import { z } from "zod";

// Create post validation
export const createPostSchema = z.object({
  body: z.object({
    threadId: z.string({ message: "Thread ID is required" }).trim(),
    parentId: z.string().trim().optional(),
    content: z
      .string({ message: "Post content is required" })
      .min(1, "Content must be at least 1 character")
      .max(10000, "Content cannot exceed 10000 characters")
      .trim(),
  }),
});

// Update post validation
export const updatePostSchema = z.object({
  body: z.object({
    content: z
      .string({ message: "Content is required" })
      .min(1, "Content must be at least 1 character")
      .max(10000, "Content cannot exceed 10000 characters")
      .trim(),
  }),
});

// Get post by ID validation
export const getPostByIdSchema = z.object({
  params: z.object({
    id: z.string({ message: "Post ID is required" }),
  }),
});

// Query validation for post list
export const queryPostSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    threadId: z.string().trim().optional(),
    parentId: z.string().trim().optional(),
    status: z.enum(["active", "deleted"]).optional(),
    moderationStatus: z
      .enum(["pending", "approved", "flagged", "rejected"])
      .optional(),
  }),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type GetPostByIdInput = z.infer<typeof getPostByIdSchema>;
export type QueryPostInput = z.infer<typeof queryPostSchema>;
