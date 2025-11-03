import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import promBundle from "express-prom-bundle";
import pinoHttp from "pino-http";
import env from "./config/env";
import globalErrorHandler from "./middleware/globalErrorHandler";
import logger from "./utils/logger";

// Import routes
// import { AnalyticsRoutes } from "./modules/analytics/analytics.routes";
import { AuthRoutes } from "./modules/auth/auth.routes";
// import { BillingRoutes } from "./modules/billing/billing.routes";
// import { InvitationRoutes } from "./modules/invitation/invitation.routes";
import { NotificationRoutes } from "./modules/notification/notification.routes";
// import OrganizationRoutes from "./modules/organization/organization.routes";
// import { TeamRoutes } from "./modules/team/team.routes";
// import { TrialRoutes } from "./modules/trial/trial.routes";
// import { UserRoutes } from "./modules/user/user.routes";
import { ThreadRoutes } from "./modules/thread/thread.routes";
import { PostRoutes } from "./modules/post/post.routes";
import { UserRoutes } from "./modules/user/user.routes";
import { AdminRoutes } from "./modules/admin/admin.routes";

const app = express();

// Prometheus metrics middleware (should be before other routes)
const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  customLabels: { app: "chat-forum-api" },
  promClient: {
    collectDefaultMetrics: {},
  },
  // Normalize API paths to reduce cardinality and avoid duplicate-slash issues
  normalizePath: (req: any) => {
    try {
      // Prefer mounted route pattern when available (baseUrl + route.path)
      let p = "";
      if (req.baseUrl && req.route && req.route.path) {
        p = `${req.baseUrl}${req.route.path}`;
      } else if (req.baseUrl) {
        p = `${req.baseUrl}${req.path || ""}`;
      } else if (req.originalUrl) {
        p = req.originalUrl.split("?")[0];
      } else {
        p = req.path || req.url || "";
      }

      // Strip query string if present
      p = p.split("?")[0];

      // Replace MongoDB ObjectIds and numeric ids with :id
      p = p.replace(/\/[a-f0-9]{24}/g, "/:id"); // MongoDB ObjectIds
      p = p.replace(/\/\d+/g, "/:id"); // Numeric IDs

      // Collapse multiple slashes into single slash (avoid // in path)
      p = p.replace(/\/\/{2,}/g, "/");

      // Remove trailing slash (unless root)
      if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);

      return p;
    } catch (err) {
      // Fallback: sanitize req.path
      return (req.path || req.url || "").replace(/\/\/{2,}/g, "/");
    }
  },
  // Custom metric labels
  metricsPath: "/metrics",
  autoregister: true,
});
app.use(metricsMiddleware);

// Response time middleware
app.use((req: any, res: any, next) => {
  const start = Date.now();
  const originalEnd = res.end;
  
  res.end = function(...args: any[]) {
    const duration = Date.now() - start;
    res.locals.responseTime = duration;
    return originalEnd.apply(res, args);
  };
  
  next();
});

// Pino HTTP logger middleware
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === "/health" || req.url === "/metrics",
    },
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 500 || err) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    customSuccessMessage: (req: any, res: any) => {
      const responseTime = res.locals.responseTime || 'N/A';
      return `🌐 ${req.method} ${req.url} → ${res.statusCode} (${responseTime}ms)`;
    },
    customErrorMessage: (req, res, err) => {
      return `❌ ${req.method} ${req.url} → ${res.statusCode} - ${err.message}`;
    },
    // Simplified serializers - hide req/res details in logs
    serializers: {
      req: () => undefined,
      res: () => undefined,
    },
  })
);

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// CORS
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use(cookieParser());

// API Routes
app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/users", UserRoutes);
app.use("/api/v1/threads", ThreadRoutes);
app.use("/api/v1/posts", PostRoutes);
app.use("/api/v1/notifications", NotificationRoutes);
app.use("/api/v1/admin", AdminRoutes);
// app.use("/api/v1/billing", BillingRoutes);
// app.use("/api/v1/teams", TeamRoutes);
// app.use("/api/v1/analytics", AnalyticsRoutes);
// app.use("/api/v1/organizations", OrganizationRoutes);
// app.use("/api/v1/invitations", InvitationRoutes);
// app.use("/api/v1/trial", TrialRoutes);

// Health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
  });
});

// Default route for testing
app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Chat Forum API is running",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      auth: "/api/v1/auth",
      users: "/api/v1/users",
      teams: "/api/v1/teams",
      analytics: "/api/v1/analytics",
      notifications: "/api/v1/notifications",
    },
  });
});

app.use(globalErrorHandler);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route Not Found",
  });
});
export default app;
