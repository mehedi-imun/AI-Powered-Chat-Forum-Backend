
import express, { type Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { AuthRoutes } from '../../modules/auth/auth.routes';
import { UserRoutes } from '../../modules/user/user.routes';
import globalErrorHandler from '../../middleware/globalErrorHandler';

export const createTestApp = (): Application => {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(
    cors({
      origin: '*',
      credentials: true,
    }),
  );

  app.use('/api/v1/auth', AuthRoutes);
  app.use('/api/v1/users', UserRoutes);

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
    });
  });

  app.use(globalErrorHandler);

  return app;
};
