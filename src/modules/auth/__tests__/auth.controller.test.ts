/**
 * Integration tests for Auth Controller
 */

import request from 'supertest';
import httpStatus from 'http-status';
import { createTestApp } from '../../../__tests__/utils/testApp';
import { createTestUser, generateTestToken } from '../../../__tests__/utils/testHelpers';
import { User } from '../../user/user.model';

// Create Express app for testing
const app = createTestApp();

describe('Auth API Integration Tests', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'New User',
          email: 'newuser@example.com',
          password: 'Test@1234',
        })
        .expect(httpStatus.CREATED);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Registration successful');

      // Verify user was created in database
      const user = await User.findOne({ email: 'newuser@example.com' });
      expect(user).toBeDefined();
      expect(user?.name).toBe('New User');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Test User',
          email: 'invalid-email',
          password: 'Test@1234',
        })
        .expect(httpStatus.BAD_REQUEST);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 400 for weak password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: '123', // Too short
        })
        .expect(httpStatus.BAD_REQUEST);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 409 if email already exists', async () => {
      await createTestUser({ email: 'existing@example.com' });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Test User',
          email: 'existing@example.com',
          password: 'Test@1234',
        })
        .expect(httpStatus.CONFLICT);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Create a verified test user
      await createTestUser({
        name: 'Login User',
        email: 'login@example.com',
        password: 'Test@1234',
        emailVerified: true,
      });
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'Test@1234',
        })
        .expect(httpStatus.OK);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe('login@example.com');
    });

    it('should return 401 for invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Test@1234',
        })
        .expect(httpStatus.UNAUTHORIZED);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Invalid email or password');
    });

    it('should return 401 for invalid password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'WrongPassword@123',
        })
        .expect(httpStatus.UNAUTHORIZED);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Invalid email or password');
    });

    it('should return 403 for unverified email', async () => {
      // Create unverified user
      await createTestUser({
        email: 'unverified@example.com',
        password: 'Test@1234',
        emailVerified: false,
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'unverified@example.com',
          password: 'Test@1234',
        })
        .expect(httpStatus.FORBIDDEN);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('verify your email');
    });
  });

  describe('POST /api/v1/auth/refresh-token', () => {
    it('should refresh access token with valid refresh token', async () => {
      const user = await createTestUser();
      const refreshToken = generateTestToken(user._id!.toString(), user.role);

      const response = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken })
        .expect(httpStatus.OK);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('accessToken');
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken: 'invalid-token' })
        .expect(httpStatus.UNAUTHORIZED);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 400 if refresh token not provided', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({})
        .expect(httpStatus.BAD_REQUEST);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    it('should change password successfully for authenticated user', async () => {
      const user = await createTestUser({
        password: 'OldPassword@123',
      });
      const token = generateTestToken(user._id!.toString(), user.role);

      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'OldPassword@123',
          newPassword: 'NewPassword@123',
        })
        .expect(httpStatus.OK);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('Password changed successfully');
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .send({
          currentPassword: 'OldPassword@123',
          newPassword: 'NewPassword@123',
        })
        .expect(httpStatus.UNAUTHORIZED);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 401 for incorrect current password', async () => {
      const user = await createTestUser({
        password: 'OldPassword@123',
      });
      const token = generateTestToken(user._id!.toString(), user.role);

      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'WrongPassword@123',
          newPassword: 'NewPassword@123',
        })
        .expect(httpStatus.UNAUTHORIZED);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Current password is incorrect');
    });
  });
});
