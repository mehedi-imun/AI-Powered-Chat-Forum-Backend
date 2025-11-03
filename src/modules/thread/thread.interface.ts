import { Types } from "mongoose";

export interface IThread {
  _id?: Types.ObjectId;
  title: string;
  slug: string;
  description?: string;
  createdBy: Types.ObjectId;
  organizationId?: Types.ObjectId;
  tags: string[];
  viewCount: number;
  postCount: number;
  lastActivityAt: Date;
  isPinned: boolean;
  isLocked: boolean;
  status: "active" | "archived" | "deleted";
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IThreadCreate {
  title: string;
  description?: string;
  tags?: string[];
  initialPostContent: string; // First post content
}

export interface IThreadUpdate {
  title?: string;
  description?: string;
  tags?: string[];
  isPinned?: boolean;
  isLocked?: boolean;
  status?: "active" | "archived" | "deleted";
}

export interface IThreadQuery {
  page?: number;
  limit?: number;
  search?: string;
  tags?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface IThreadWithAuthor extends IThread {
  author?: {
    _id: Types.ObjectId;
    name: string;
    email: string;
    role: string;
  };
}
