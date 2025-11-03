import { z } from "zod";

export const UserRoleEnum = z.enum(["Admin", "Moderator", "Member"]);

export const updateUserSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(50, "Name cannot exceed 50 characters")
      .optional(),
    avatar: z.string().url("Invalid avatar URL").optional(),
    bio: z.string().max(500, "Bio cannot exceed 500 characters").optional(),
  }),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
