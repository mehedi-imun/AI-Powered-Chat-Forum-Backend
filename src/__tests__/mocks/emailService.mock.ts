/**
 * Mock email service for testing
 */

export const emailService = {
  sendEmailVerification: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendNotificationEmail: jest.fn().mockResolvedValue(undefined),
};
