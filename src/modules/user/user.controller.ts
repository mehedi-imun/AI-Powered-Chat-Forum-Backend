import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { UserService } from "./user.service";

const getAllUsers = catchAsync(async (req, res) => {
	const result = await UserService.getAllUsers(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Users retrieved successfully",
		data: result,
	});
});

const getUserById = catchAsync(async (req, res) => {
	const user = await UserService.getUserById(req.params.id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User retrieved successfully",
		data: user,
	});
});

const updateUser = catchAsync(async (req, res) => {
	const userId = req.user?.userId;
	const user = await UserService.updateUser(userId!, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile updated successfully",
		data: user,
	});
});

const deleteUser = catchAsync(async (req, res) => {
	await UserService.deleteUser(req.params.id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User deleted successfully",
		data: null,
	});
});

export const UserController = {
	getAllUsers,
	getUserById,
	updateUser,
	deleteUser,
};
