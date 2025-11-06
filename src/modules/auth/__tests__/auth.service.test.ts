import httpStatus from "http-status";
import { AuthService } from "../auth.service";
import { User } from "../../user/user.model";
import AppError from "../../../errors/AppError";
import { emailService } from "../../../services/email.service";
import * as jwt from "../../../utils/jwt";

jest.mock("../../user/user.model");
jest.mock("../../../services/email.service");
jest.mock("../../../utils/jwt");

describe("AuthService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("register", () => {
    it("should register a new user successfully", async () => {
      const mockUser = {
        _id: "user123",
        name: "Test User",
        email: "test@example.com",
        role: "Member",
        emailVerified: true,
      };

      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User.create as jest.Mock).mockResolvedValue(mockUser);
      (emailService.sendEmailVerification as jest.Mock).mockResolvedValue(true);

      const result = await AuthService.register(
        "Test User",
        "test@example.com",
        "Test@1234"
      );

      expect(result).toHaveProperty("message");
      expect(result.message).toContain("Registration successful");
      expect(User.findOne).toHaveBeenCalledWith({ email: "test@example.com" });
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test User",
          email: "test@example.com",
          password: "Test@1234",
          role: "Member",
          emailVerified: false,
        })
      );
    });

    it("should throw error if email already exists", async () => {
      (User.findOne as jest.Mock).mockResolvedValue({
        email: "test@example.com",
      });

      await expect(
        AuthService.register("Test User", "test@example.com", "Test@1234")
      ).rejects.toThrow(AppError);

      await expect(
        AuthService.register("Test User", "test@example.com", "Test@1234")
      ).rejects.toMatchObject({
        statusCode: httpStatus.CONFLICT,
        message: "User with this email already exists",
      });
    });
  });

  describe("login", () => {
    it("should login user successfully with valid credentials", async () => {
      const mockUser = {
        _id: "user123",
        email: "test@example.com",
        name: "Test User",
        role: "Member",
        emailVerified: true,
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
        toJSON: jest.fn().mockReturnValue({
          _id: "user123",
          email: "test@example.com",
          name: "Test User",
          role: "Member",
        }),
      };

      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });
      (jwt.generateAccessToken as jest.Mock).mockReturnValue("access-token");
      (jwt.generateRefreshToken as jest.Mock).mockReturnValue("refresh-token");

      const result = await AuthService.login("test@example.com", "Test@1234");

      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(result.accessToken).toBe("access-token");
      expect(result.refreshToken).toBe("refresh-token");
      expect(mockUser.save).toHaveBeenCalled();
    });

    it("should throw error for invalid email", async () => {
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(
        AuthService.login("invalid@example.com", "Test@1234")
      ).rejects.toThrow(AppError);

      await expect(
        AuthService.login("invalid@example.com", "Test@1234")
      ).rejects.toMatchObject({
        statusCode: httpStatus.UNAUTHORIZED,
        message: "Invalid email or password",
      });
    });

    it("should throw error for unverified email", async () => {
      const mockUser = {
        emailVerified: false,
      };

      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(
        AuthService.login("test@example.com", "Test@1234")
      ).rejects.toThrow(AppError);

      await expect(
        AuthService.login("test@example.com", "Test@1234")
      ).rejects.toMatchObject({
        statusCode: httpStatus.FORBIDDEN,
        message: "Please verify your email address before logging in",
      });
    });

    it("should throw error for invalid password", async () => {
      const mockUser = {
        emailVerified: true,
        comparePassword: jest.fn().mockResolvedValue(false),
      };

      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(
        AuthService.login("test@example.com", "WrongPassword")
      ).rejects.toThrow(AppError);

      await expect(
        AuthService.login("test@example.com", "WrongPassword")
      ).rejects.toMatchObject({
        statusCode: httpStatus.UNAUTHORIZED,
        message: "Invalid email or password",
      });
    });
  });

  describe("refreshAccessToken", () => {
    it("should refresh access token successfully", async () => {
      const mockDecoded = {
        userId: "user123",
        email: "test@example.com",
        role: "Member",
      };

      const mockUser = {
        _id: "user123",
        email: "test@example.com",
        role: "Member",
      };

      (jwt.verifyRefreshToken as jest.Mock).mockReturnValue(mockDecoded);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (jwt.generateAccessToken as jest.Mock).mockReturnValue(
        "new-access-token"
      );

      const result = await AuthService.refreshAccessToken(
        "valid-refresh-token"
      );

      expect(result).toHaveProperty("accessToken");
      expect(result.accessToken).toBe("new-access-token");
    });

    it("should throw error for invalid refresh token", async () => {
      (jwt.verifyRefreshToken as jest.Mock).mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await expect(
        AuthService.refreshAccessToken("invalid-token")
      ).rejects.toThrow(AppError);

      await expect(
        AuthService.refreshAccessToken("invalid-token")
      ).rejects.toMatchObject({
        statusCode: httpStatus.UNAUTHORIZED,
        message: "Invalid refresh token",
      });
    });

    it("should throw error if user not found", async () => {
      const mockDecoded = {
        userId: "user123",
        email: "test@example.com",
        role: "Member",
      };

      (jwt.verifyRefreshToken as jest.Mock).mockReturnValue(mockDecoded);
      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        AuthService.refreshAccessToken("valid-refresh-token")
      ).rejects.toThrow(AppError);

      await expect(
        AuthService.refreshAccessToken("valid-refresh-token")
      ).rejects.toMatchObject({
        statusCode: httpStatus.UNAUTHORIZED,
        message: "Invalid refresh token",
      });
    });
  });

  describe("changePassword", () => {
    it("should change password successfully", async () => {
      const mockUser = {
        _id: "user123",
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };

      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await AuthService.changePassword(
        "user123",
        "OldPassword@123",
        "NewPassword@123"
      );

      expect(result).toHaveProperty("message");
      expect(result.message).toBe("Password changed successfully");
      expect(mockUser.save).toHaveBeenCalled();
    });

    it("should throw error if user not found", async () => {
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(
        AuthService.changePassword("user123", "OldPassword", "NewPassword")
      ).rejects.toThrow(AppError);

      await expect(
        AuthService.changePassword("user123", "OldPassword", "NewPassword")
      ).rejects.toMatchObject({
        statusCode: httpStatus.NOT_FOUND,
        message: "User not found",
      });
    });

    it("should throw error if current password is incorrect", async () => {
      const mockUser = {
        comparePassword: jest.fn().mockResolvedValue(false),
      };

      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(
        AuthService.changePassword("user123", "WrongPassword", "NewPassword")
      ).rejects.toThrow(AppError);

      await expect(
        AuthService.changePassword("user123", "WrongPassword", "NewPassword")
      ).rejects.toMatchObject({
        statusCode: httpStatus.UNAUTHORIZED,
        message: "Current password is incorrect",
      });
    });
  });
});
