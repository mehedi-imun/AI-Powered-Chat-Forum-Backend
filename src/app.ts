import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import promBundle from "express-prom-bundle";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import pinoHttp from "pino-http";
import env from "./config/env";
import globalErrorHandler from "./middleware/globalErrorHandler";
import { AdminRoutes } from "./modules/admin/admin.routes";
import { AuthRoutes } from "./modules/auth/auth.routes";
import { NotificationRoutes } from "./modules/notification/notification.routes";
import { PostRoutes } from "./modules/post/post.routes";
import { ThreadRoutes } from "./modules/thread/thread.routes";
import { UserRoutes } from "./modules/user/user.routes";
import logger from "./utils/logger";

const app = express();

// IMPORTANT: Prometheus metrics must be registered before other middleware to capture all requests
const metricsMiddleware = promBundle({
	includeMethod: true,
	includePath: true,
	includeStatusCode: true,
	includeUp: true,
	customLabels: { app: "chat-forum-api" },
	promClient: {
		collectDefaultMetrics: {},
	},
	normalizePath: (req: any) => {
		try {
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

			p = p.split("?")[0];
			p = p.replace(/\/[a-f0-9]{24}/g, "/:id");
			p = p.replace(/\/\d+/g, "/:id");
			p = p.replace(/\/\/{2,}/g, "/");
			if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);

			return p;
		} catch (err) {
			return (req.path || req.url || "").replace(/\/\/{2,}/g, "/");
		}
	},
	metricsPath: "/metrics",
	autoregister: true,
});
app.use(metricsMiddleware);

app.use((req: any, res: any, next) => {
	const start = Date.now();
	const originalEnd = res.end;

	res.end = (...args: any[]) => {
		const duration = Date.now() - start;
		res.locals.responseTime = duration;
		return originalEnd.apply(res, args);
	};

	next();
});

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
			const responseTime = res.locals.responseTime || "N/A";
			return `🌐 ${req.method} ${req.url} → ${res.statusCode} (${responseTime}ms)`;
		},
		customErrorMessage: (req, res, err) => {
			return `❌ ${req.method} ${req.url} → ${res.statusCode} - ${err.message}`;
		},
		serializers: {
			req: () => undefined,
			res: () => undefined,
		},
	}),
);

app.use(helmet());

const limiter = rateLimit({
	windowMs: env.RATE_LIMIT_WINDOW_MS,
	max: env.RATE_LIMIT_MAX_REQUESTS,
	message: "Too many requests from this IP, please try again later.",
	standardHeaders: true,
	legacyHeaders: false,
});
app.use("/api/", limiter);

app.use(
	cors({
		origin: env.FRONTEND_URL,
		credentials: true,
	}),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/users", UserRoutes);
app.use("/api/v1/threads", ThreadRoutes);
app.use("/api/v1/posts", PostRoutes);
app.use("/api/v1/notifications", NotificationRoutes);
app.use("/api/v1/admin", AdminRoutes);
app.get("/health", (_req, res) => {
	res.status(200).json({
		success: true,
		message: "Server is healthy",
		timestamp: new Date().toISOString(),
	});
});

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

app.use((req, res) => {
	res.status(404).json({
		success: false,
		message: "Route Not Found",
	});
});
export default app;
