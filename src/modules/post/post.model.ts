import { Schema, model } from "mongoose";
import { IPost } from "./post.interface";

const postSchema = new Schema<IPost>(
  {
    threadId: {
      type: Schema.Types.ObjectId,
      ref: "Thread",
      required: [true, "Thread ID is required"],
      index: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      default: null,
      index: true,
    },
    content: {
      type: String,
      required: [true, "Post content is required"],
      trim: true,
      minlength: [1, "Content must be at least 1 character"],
      maxlength: [10000, "Content cannot exceed 10000 characters"],
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Post author is required"],
      index: true,
    },
    mentions: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
    },
    moderationStatus: {
      type: String,
      enum: ["pending", "approved", "flagged", "rejected"],
      default: "approved", // Auto-approve for now, AI will check async
      index: true,
    },
    aiScore: {
      spam: {
        type: Number,
        min: 0,
        max: 1,
      },
      toxicity: {
        type: Number,
        min: 0,
        max: 1,
      },
      sentiment: {
        type: String,
        enum: ["positive", "neutral", "negative"],
      },
    },
    status: {
      type: String,
      enum: ["active", "deleted"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
postSchema.index({ threadId: 1, status: 1, createdAt: 1 });
postSchema.index({ threadId: 1, parentId: 1, status: 1 });
postSchema.index({ author: 1, status: 1 });
postSchema.index({ moderationStatus: 1, createdAt: -1 });

// Virtual for replies
postSchema.virtual("replies", {
  ref: "Post",
  localField: "_id",
  foreignField: "parentId",
});

// Method to extract mentions from content
postSchema.methods.extractMentions = function (): string[] {
  const mentionRegex = /@(\w+)/g;
  const matches = this.content.match(mentionRegex);
  return matches ? matches.map((m: string) => m.substring(1)) : [];
};

export const Post = model<IPost>("Post", postSchema);
