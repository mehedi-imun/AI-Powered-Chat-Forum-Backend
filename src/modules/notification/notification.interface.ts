import { Types } from "mongoose";

export type NotificationType = 
  | "mention"
  | "reply"
  | "thread_comment"
  | "post_like"
  | "follow"
  | "system";

export interface INotification {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  relatedUserId?: Types.ObjectId;
  relatedThreadId?: Types.ObjectId;
  relatedPostId?: Types.ObjectId;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotificationCreate {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  relatedUserId?: string;
  relatedThreadId?: string;
  relatedPostId?: string;
}

export interface INotificationWithRelations extends INotification {
  relatedUser?: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  relatedThread?: {
    _id: string;
    title: string;
    slug: string;
  };
  relatedPost?: {
    _id: string;
    content: string;
  };
}

export interface INotificationQuery {
  page?: number;
  limit?: number;
  isRead?: boolean;
  type?: NotificationType;
}
