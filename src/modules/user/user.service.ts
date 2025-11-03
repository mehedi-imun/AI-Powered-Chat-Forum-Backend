import httpStatus from "http-status";
import { Types } from "mongoose";
import AppError from "../../errors/AppError";
import { emailService } from "../../services/email.service";
import QueryBuilder from "../../utils/queryBuilder";
import {
  IUser,
  IUserCreate,
  IUserUpdate,
  IUserWithoutPassword,
} from "./user.interface";
import { User } from "./user.model";

// Get all users with pagination, search, filter
const getAllUsers = async (query: any) => {
  const searchableFields = ["name", "email"];

  // Map 'search' to 'searchTerm' for QueryBuilder compatibility
  const mappedQuery = { ...query };
  if (mappedQuery.search) {
    mappedQuery.searchTerm = mappedQuery.search;
    delete mappedQuery.search;
  }

  const queryBuilder = new QueryBuilder<IUser>(User.find(), mappedQuery);

  const userQuery = queryBuilder
    .search(searchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const [data, meta] = await Promise.all([
    userQuery.build().exec(),
    queryBuilder.countTotal(),
  ]);

  return { data, meta };
};

// Get single user by ID
const getUserById = async (
  id: string
): Promise<IUserWithoutPassword | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  const user = await User.findById(id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return user;
};

// Get user by email
const getUserByEmail = async (email: string): Promise<IUser | null> => {
  return await User.findOne({ email }).select("+password");
};

// Create new user (Admin only)
const createUser = async (
  userData: IUserCreate
): Promise<IUserWithoutPassword> => {
  // Check if user already exists
  const existingUser = await User.findOne({ email: userData.email });
  if (existingUser) {
    throw new AppError(
      httpStatus.CONFLICT,
      "User with this email already exists"
    );
  }

  const user = await User.create(userData);

  // Send welcome email
  await emailService.sendWelcomeEmail(user.email, user.name, user.role);

  return user;
};

// Update user
const updateUser = async (
  id: string,
  updateData: IUserUpdate
): Promise<IUserWithoutPassword | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  // Don't allow email update
  if ("email" in updateData) {
    throw new AppError(httpStatus.BAD_REQUEST, "Email cannot be updated");
  }

  const user = await User.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return user;
};

// Delete user
const deleteUser = async (id: string): Promise<void> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  const user = await User.findByIdAndDelete(id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }
};

// Change password
const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  const user = await User.findById(userId).select("+password");
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // Verify current password
  const isPasswordValid = await (user as any).comparePassword(currentPassword);
  if (!isPasswordValid) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Current password is incorrect"
    );
  }

  // Update password
  user.password = newPassword;
  await user.save();
};

// Toggle user active status
const toggleUserStatus = async (
  id: string
): Promise<IUserWithoutPassword | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  const user = await User.findById(id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  user.isActive = !user.isActive;
  await user.save();

  return user;
};

// Update user role (SuperAdmin/Admin only)
const updateUserRole = async (
  id: string,
  role: "SuperAdmin" | "Admin" | "Member"
): Promise<IUserWithoutPassword | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  const user = await User.findByIdAndUpdate(
    id,
    { role },
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return user;
};

// Update user status (SuperAdmin/Admin only)
const updateUserStatus = async (
  id: string,
  status: "active" | "inactive" | "suspended"
): Promise<IUserWithoutPassword | null> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  // Convert status to isActive boolean
  const isActive = status === "active";

  const user = await User.findByIdAndUpdate(
    id,
    { isActive },
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return user;
};

export const UserService = {
  getAllUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUser,
  deleteUser,
  changePassword,
  toggleUserStatus,
  updateUserRole,
  updateUserStatus,
};
