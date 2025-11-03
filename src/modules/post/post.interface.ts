import type { Types } from "mongoose";

export interface IPost {
	_id?: Types.ObjectId;
	threadId: Types.ObjectId;
	parentId?: Types.ObjectId; // For nested replies
	content: string;
	author: Types.ObjectId;
	mentions: Types.ObjectId[];
	isEdited: boolean;
	editedAt?: Date;
	moderationStatus: "pending" | "approved" | "flagged" | "rejected";
	aiScore?: {
		spam: number;
		toxicity: number;
		inappropriate: number;
		sentiment?: string;
	};
	status: "active" | "deleted";
	createdAt?: Date;
	updatedAt?: Date;
}

export interface IPostCreate {
	threadId: string;
	parentId?: string;
	content: string;
}

export interface IPostUpdate {
	content: string;
}

export interface IPostWithAuthor extends Omit<IPost, "author"> {
	author: {
		_id: Types.ObjectId;
		name: string;
		email: string;
		role: string;
	};
	replies?: IPostWithAuthor[];
}

export interface IPostQuery {
	page?: number;
	limit?: number;
	threadId?: string;
	parentId?: string;
	status?: string;
	moderationStatus?: string;
}
