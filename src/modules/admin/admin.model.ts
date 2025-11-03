import { Schema, model } from "mongoose";
import { IReport, IActivityLog, IBan, ISystemSettings } from "./admin.interface";

// Report Model
const reportSchema = new Schema<IReport>(
  {
    reportedContentType: {
      type: String,
      enum: ["thread", "post", "user"],
      required: true,
      index: true,
    },
    reportedContentId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: "reportedContentType",
      index: true,
    },
    reportType: {
      type: String,
      enum: ["spam", "harassment", "inappropriate", "misinformation", "other"],
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "reviewing", "resolved", "dismissed"],
      default: "pending",
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewNote: {
      type: String,
      maxlength: 500,
    },
    resolution: {
      type: String,
      enum: ["content_removed", "user_warned", "user_banned", "no_action"],
    },
    resolvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reportedContentType: 1, reportedContentId: 1 });

// Activity Log Model
const activityLogSchema = new Schema<IActivityLog>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: [
        "user_banned",
        "user_unbanned",
        "user_role_changed",
        "content_deleted",
        "report_resolved",
        "settings_updated",
      ],
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ["user", "thread", "post", "report"],
    },
    targetId: {
      type: Schema.Types.ObjectId,
    },
    details: {
      type: Schema.Types.Mixed,
      required: true,
    },
    ipAddress: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
activityLogSchema.index({ adminId: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });

// Ban Model
const banSchema = new Schema<IBan>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      maxlength: 500,
    },
    bannedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bannedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    expiresAt: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
banSchema.index({ userId: 1, isActive: 1 });
banSchema.index({ expiresAt: 1 });

// System Settings Model
const systemSettingsSchema = new Schema<ISystemSettings>(
  {
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    registrationEnabled: {
      type: Boolean,
      default: true,
    },
    emailVerificationRequired: {
      type: Boolean,
      default: true,
    },
    maxThreadTitleLength: {
      type: Number,
      default: 200,
      min: 50,
      max: 500,
    },
    maxPostContentLength: {
      type: Number,
      default: 10000,
      min: 100,
      max: 50000,
    },
    maxTagsPerThread: {
      type: Number,
      default: 10,
      min: 1,
      max: 20,
    },
    allowedFileTypes: {
      type: [String],
      default: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    },
    maxFileSize: {
      type: Number,
      default: 5, // MB
      min: 1,
      max: 50,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Report = model<IReport>("Report", reportSchema);
export const ActivityLog = model<IActivityLog>("ActivityLog", activityLogSchema);
export const Ban = model<IBan>("Ban", banSchema);
export const SystemSettings = model<ISystemSettings>(
  "SystemSettings",
  systemSettingsSchema
);
