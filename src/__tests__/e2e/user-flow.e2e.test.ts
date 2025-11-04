/**
 * E2E Tests - Complete User Flows
 * Tests real-world scenarios from registration to profile management
 */

import request from 'supertest';
import httpStatus from 'http-status';
import { createTestApp } from '../utils/testApp';

const app = createTestApp();

describe('E2E Tests - User Flow', () => {
  let accessToken: string;
  let refreshToken: string;
  let userId: string;
  const userEmail = `e2e_${Date.now()}@example.com`;
  const userPassword = 'Test@1234';

  describe('Complete Registration and Login Flow', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'E2E Test User',
          email: userEmail,
          password: userPassword,
        })
        .expect(httpStatus.CREATED);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('Registration successful');
    });

    it('should login with registered credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: userEmail,
          password: userPassword,
        })
        .expect(httpStatus.OK);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data).toHaveProperty('user');

      // Save tokens for subsequent tests
      accessToken = response.body.data.accessToken;
      refreshToken = response.body.data.refreshToken;
      userId = response.body.data.user._id;

      expect(response.body.data.user.email).toBe(userEmail);
      expect(response.body.data.user.name).toBe('E2E Test User');
    });

    it('should not login with incorrect password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: userEmail,
          password: 'WrongPassword@123',
        })
        .expect(httpStatus.UNAUTHORIZED);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Invalid email or password');
    });
  });

  describe('Token Management Flow', () => {
    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken })
        .expect(httpStatus.OK);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('accessToken');

      // Update access token
      accessToken = response.body.data.accessToken;
    });

    it('should reject invalid refresh token', async () => {
      await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken: 'invalid-token' })
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('Profile Management Flow', () => {
    it('should get own profile', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('email', userEmail);
      expect(response.body.data).toHaveProperty('name', 'E2E Test User');
    });

    it('should update profile', async () => {
      const response = await request(app)
        .patch(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Updated E2E User',
          bio: 'This is my updated bio',
        })
        .expect(httpStatus.OK);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('name', 'Updated E2E User');
      expect(response.body.data).toHaveProperty('bio', 'This is my updated bio');
    });

    it('should not allow updating other users profile', async () => {
      const otherUserId = '507f1f77bcf86cd799439011'; // Random valid ObjectId

      const response = await request(app)
        .patch(`/api/v1/users/${otherUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Hacked Name',
        })
        .expect(httpStatus.FORBIDDEN);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Password Management Flow', () => {
    it('should request password reset', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: userEmail })
        .expect(httpStatus.OK);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('password reset link');
    });

    it('should handle forgot password for non-existent email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(httpStatus.OK);

      // Should still return success to prevent email enumeration
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('Security & Authorization', () => {
    it('should reject requests without authentication', async () => {
      await request(app)
        .get(`/api/v1/users/${userId}`)
        .expect(httpStatus.UNAUTHORIZED);
    });

    it('should reject requests with invalid token', async () => {
      await request(app)
        .get(`/api/v1/users/${userId}`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(httpStatus.UNAUTHORIZED);
    });

    it('should reject requests with expired token', async () => {
      // Create token with very short expiry
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzI5YTQ5YzRiNzJmZDg5ZjY2MjcyZTAiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJyb2xlIjoiTWVtYmVyIiwiaWF0IjoxNzMwNzU1NzQwLCJleHAiOjE3MzA3NTU3NDF9.invalid';

      await request(app)
        .get(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('Validation Tests', () => {
    it('should reject registration with invalid email', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Test',
          email: 'invalid-email',
          password: 'Test@1234',
        })
        .expect(httpStatus.BAD_REQUEST);
    });

    it('should reject registration with weak password', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Test',
          email: 'test@example.com',
          password: '123', // Too short
        })
        .expect(httpStatus.BAD_REQUEST);
    });

    it('should reject profile update with invalid data', async () => {
      await request(app)
        .patch(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: '', // Empty name
        })
        .expect(httpStatus.BAD_REQUEST);
    });
  });
});
