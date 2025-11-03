import { Types } from "mongoose";

export interface IUser {
  _id?: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: "Admin" | "Moderator" | "Member";
  avatar?: string;
  bio?: string;
  isActive: boolean;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type IUserWithoutPassword = Omit<IUser, "password">;

export interface IUserCreate {
  name: string;
  email: string;
  password: string;
  role?: "Admin" | "Moderator" | "Member";
}

export interface IUserUpdate {
  name?: string;
  avatar?: string;
  bio?: string;
}
