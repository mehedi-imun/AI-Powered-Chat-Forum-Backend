import { Types } from "mongoose";

export interface IDashboardStats {
  totalUsers: number;
  totalThreads: number;
  totalPosts: number;
  totalReports: number;
  activeUsers: number;
  newUsersToday: number;
  newThreadsToday: number;
  newPostsToday: number;
  pendingReports: number;
  bannedUsers: number;
}

export interface IUserFilter {
  role?: "Admin" | "Moderator" | "Member";
  isActive?: boolean;
  emailVerified?: boolean;
  searchTerm?: string;
  page?: number;
  limit?: number;
  sort?: string;
}

export interface IUserUpdate {
  name?: string;
  role?: "Admin" | "Moderator" | "Member";
  isActive?: boolean;
  bio?: string;
}

export interface IBanUser {
  reason: string;
  duration?: number; // in days, undefined = permanent
  bannedBy: Types.ObjectId;
}

export interface IReportCreate {
  reportedContentType: "thread" | "post" | "user";
  reportedContentId: Types.ObjectId;
  reportType:
    | "spam"
    | "harassment"
    | "inappropriate"
    | "misinformation"
    | "other";
  description: string;
  reportedBy: Types.ObjectId;
}

export interface IReport {
  _id: Types.ObjectId;
  reportedContentType: "thread" | "post" | "user";
  reportedContentId: Types.ObjectId;
  reportType:
    | "spam"
    | "harassment"
    | "inappropriate"
    | "misinformation"
    | "other";
  description: string;
  reportedBy: Types.ObjectId;
  status: "pending" | "reviewing" | "resolved" | "dismissed";
  reviewedBy?: Types.ObjectId;
  reviewNote?: string;
  resolution?: "content_removed" | "user_warned" | "user_banned" | "no_action";
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

export interface IReportFilter {
  status?: "pending" | "reviewing" | "resolved" | "dismissed";
  reportType?:
    | "spam"
    | "harassment"
    | "inappropriate"
    | "misinformation"
    | "other";
  reportedContentType?: "thread" | "post" | "user";
  page?: number;
  limit?: number;
}

export interface IReportAction {
  reportId: string;
  action: "resolve" | "dismiss";
  resolution?: "content_removed" | "user_warned" | "user_banned" | "no_action";
  reviewNote?: string;
  reviewedBy: string;
}

export interface IActivityLog {
  _id: Types.ObjectId;
  adminId: Types.ObjectId;
  action:
    | "user_banned"
    | "user_unbanned"
    | "user_role_changed"
    | "content_deleted"
    | "report_resolved"
    | "settings_updated";
  targetType?: "user" | "thread" | "post" | "report";
  targetId?: Types.ObjectId;
  details: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
}

export interface IActivityLogCreate {
  adminId: Types.ObjectId;
  action:
    | "user_banned"
    | "user_unbanned"
    | "user_role_changed"
    | "content_deleted"
    | "report_resolved"
    | "settings_updated";
  targetType?: "user" | "thread" | "post" | "report";
  targetId?: Types.ObjectId;
  details: Record<string, any>;
  ipAddress?: string;
}

export interface IBan {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  reason: string;
  bannedBy: Types.ObjectId;
  bannedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface ISystemSettings {
  _id: Types.ObjectId;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  emailVerificationRequired: boolean;
  maxThreadTitleLength: number;
  maxPostContentLength: number;
  maxTagsPerThread: number;
  allowedFileTypes: string[];
  maxFileSize: number; // in MB
  updatedBy: Types.ObjectId;
  updatedAt: Date;
}
