import httpStatus from "http-status";
import { Types } from "mongoose";
import AppError from "../../errors/AppError";
import QueryBuilder from "../../utils/queryBuilder";
import {
  IUser,
  IUserCreate,
  IUserUpdate,
  IUserWithoutPassword,
} from "./user.interface";
import { User } from "./user.model";

const getAllUsers = async (query: any) => {
  const searchableFields = ["name", "email"];

  const queryBuilder = new QueryBuilder(User.find(), query)
    .search(searchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const users = await queryBuilder.modelQuery;
  const total = await User.countDocuments();

  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;

  return {
    users: users as IUserWithoutPassword[],
    total,
    page,
    limit,
  };
};

const getUserById = async (id: string): Promise<IUserWithoutPassword> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  const user = await User.findById(id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return user as IUserWithoutPassword;
};

const getUserByEmail = async (email: string): Promise<IUser | null> => {
  return await User.findOne({ email }).select("+password");
};

const createUser = async (userData: IUserCreate): Promise<IUserWithoutPassword> => {
  const existingUser = await User.findOne({ email: userData.email });
  if (existingUser) {
    throw new AppError(httpStatus.CONFLICT, "User with this email already exists");
  }

  const user = await User.create(userData);
  return user as IUserWithoutPassword;
};

const updateUser = async (
  id: string,
  updateData: IUserUpdate
): Promise<IUserWithoutPassword> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  const user = await User.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return user as IUserWithoutPassword;
};

const deleteUser = async (id: string): Promise<void> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  const user = await User.findByIdAndDelete(id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }
};

export const UserService = {
  getAllUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUser,
  deleteUser,
};
