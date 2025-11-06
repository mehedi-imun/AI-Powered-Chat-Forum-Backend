
import httpStatus from 'http-status';
import { Types } from 'mongoose';
import { UserService } from '../user.service';
import { User } from '../user.model';
import AppError from '../../../errors/AppError';
import QueryBuilder from '../../../utils/queryBuilder';

jest.mock('../user.model');
jest.mock('../../../utils/queryBuilder');

describe('UserService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserById', () => {
    it('should get user by ID successfully', async () => {
      const mockUser = {
        _id: new Types.ObjectId(),
        name: 'Test User',
        email: 'test@example.com',
        role: 'Member',
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      const result = await UserService.getUserById(mockUser._id.toString());

      expect(result).toEqual(mockUser);
      expect(User.findById).toHaveBeenCalledWith(mockUser._id.toString());
    });

    it('should throw error for invalid user ID', async () => {
      await expect(UserService.getUserById('invalid-id')).rejects.toThrow(
        AppError,
      );

      await expect(UserService.getUserById('invalid-id')).rejects.toMatchObject({
        statusCode: httpStatus.BAD_REQUEST,
        message: 'Invalid user ID',
      });
    });

    it('should throw error if user not found', async () => {
      const validId = new Types.ObjectId().toString();
      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(UserService.getUserById(validId)).rejects.toThrow(AppError);

      await expect(UserService.getUserById(validId)).rejects.toMatchObject({
        statusCode: httpStatus.NOT_FOUND,
        message: 'User not found',
      });
    });
  });

  describe('getUserByEmail', () => {
    it('should get user by email successfully', async () => {
      const mockUser = {
        _id: new Types.ObjectId(),
        email: 'test@example.com',
        password: 'hashed-password',
      };

      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await UserService.getUserByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    });

    it('should return null if user not found', async () => {
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const result = await UserService.getUserByEmail('notfound@example.com');

      expect(result).toBeNull();
    });
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      const userData = {
        name: 'New User',
        email: 'newuser@example.com',
        password: 'Test@1234',
        role: 'Member' as const,
      };

      const mockUser = {
        _id: new Types.ObjectId(),
        ...userData,
      };

      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await UserService.createUser(userData);

      expect(result).toEqual(mockUser);
      expect(User.findOne).toHaveBeenCalledWith({ email: userData.email });
      expect(User.create).toHaveBeenCalledWith(userData);
    });

    it('should throw error if email already exists', async () => {
      const userData = {
        name: 'New User',
        email: 'existing@example.com',
        password: 'Test@1234',
        role: 'Member' as const,
      };

      (User.findOne as jest.Mock).mockResolvedValue({ email: userData.email });

      await expect(UserService.createUser(userData)).rejects.toThrow(AppError);

      await expect(UserService.createUser(userData)).rejects.toMatchObject({
        statusCode: httpStatus.CONFLICT,
        message: 'User with this email already exists',
      });
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const userId = new Types.ObjectId().toString();
      const updateData = {
        name: 'Updated Name',
        bio: 'Updated bio',
      };

      const mockUpdatedUser = {
        _id: userId,
        name: 'Updated Name',
        bio: 'Updated bio',
        email: 'test@example.com',
      };

      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockUpdatedUser);

      const result = await UserService.updateUser(userId, updateData);

      expect(result).toEqual(mockUpdatedUser);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(userId, updateData, {
        new: true,
        runValidators: true,
      });
    });

    it('should throw error for invalid user ID', async () => {
      const updateData = { name: 'Updated Name' };

      await expect(
        UserService.updateUser('invalid-id', updateData),
      ).rejects.toThrow(AppError);

      await expect(
        UserService.updateUser('invalid-id', updateData),
      ).rejects.toMatchObject({
        statusCode: httpStatus.BAD_REQUEST,
        message: 'Invalid user ID',
      });
    });

    it('should throw error if user not found', async () => {
      const userId = new Types.ObjectId().toString();
      const updateData = { name: 'Updated Name' };

      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);

      await expect(UserService.updateUser(userId, updateData)).rejects.toThrow(
        AppError,
      );

      await expect(
        UserService.updateUser(userId, updateData),
      ).rejects.toMatchObject({
        statusCode: httpStatus.NOT_FOUND,
        message: 'User not found',
      });
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      const userId = new Types.ObjectId().toString();
      const mockUser = {
        _id: userId,
        name: 'Test User',
      };

      (User.findByIdAndDelete as jest.Mock).mockResolvedValue(mockUser);

      await UserService.deleteUser(userId);

      expect(User.findByIdAndDelete).toHaveBeenCalledWith(userId);
    });

    it('should throw error for invalid user ID', async () => {
      await expect(UserService.deleteUser('invalid-id')).rejects.toThrow(
        AppError,
      );

      await expect(UserService.deleteUser('invalid-id')).rejects.toMatchObject({
        statusCode: httpStatus.BAD_REQUEST,
        message: 'Invalid user ID',
      });
    });

    it('should throw error if user not found', async () => {
      const userId = new Types.ObjectId().toString();

      (User.findByIdAndDelete as jest.Mock).mockResolvedValue(null);

      await expect(UserService.deleteUser(userId)).rejects.toThrow(AppError);

      await expect(UserService.deleteUser(userId)).rejects.toMatchObject({
        statusCode: httpStatus.NOT_FOUND,
        message: 'User not found',
      });
    });
  });

  describe('getAllUsers', () => {
    it('should get all users with pagination', async () => {
      const mockUsers = [
        { _id: new Types.ObjectId(), name: 'User 1', email: 'user1@example.com' },
        { _id: new Types.ObjectId(), name: 'User 2', email: 'user2@example.com' },
      ];

      const mockQuery = {
        page: '1',
        limit: '10',
      };

      const mockQueryBuilder = {
        search: jest.fn().mockReturnThis(),
        filter: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        paginate: jest.fn().mockReturnThis(),
        fields: jest.fn().mockReturnThis(),
        modelQuery: Promise.resolve(mockUsers),
      };

      (QueryBuilder as jest.Mock).mockImplementation(() => mockQueryBuilder);
      (User.countDocuments as jest.Mock).mockResolvedValue(2);

      const result = await UserService.getAllUsers(mockQuery);

      expect(result).toEqual({
        users: mockUsers,
        total: 2,
        page: 1,
        limit: 10,
      });
    });
  });
});
