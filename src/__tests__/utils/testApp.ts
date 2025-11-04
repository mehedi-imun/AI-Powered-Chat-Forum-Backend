/**
 * Test app configuration
 * Mimics the main app but without server-specific setup
 */

import express, { type Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { AuthRoutes } from '../../modules/auth/auth.routes';
import { UserRoutes } from '../../modules/user/user.routes';
import globalErrorHandler from '../../middleware/globalErrorHandler';

/**
 * Create Express app for testing
 */
export const createTestApp = (): Application => {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(
    cors({
      origin: '*',
      credentials: true,
    }),
  );

  // Routes
  app.use('/api/v1/auth', AuthRoutes);
  app.use('/api/v1/users', UserRoutes);

  // Health check
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
    });
  });

  // Global error handler
  app.use(globalErrorHandler);

  return app;
};
