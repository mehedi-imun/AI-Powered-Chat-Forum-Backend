import type { NextFunction, Request, RequestHandler, Response } from "express";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { getRedisClient } from "../config/redis";

interface RateLimiterOptions {
	windowMs: number;
	max: number;
	prefix: string;
	message: string;
	skipRead?: boolean;
}

const buildHandler =
	(message: string) =>
	(_req: Request, res: Response, _next: NextFunction): void => {
		res.status(429).json({
			success: false,
			message,
			errorSources: [{ path: "", message }],
		});
	};

export const createRateLimiter = (
	options: RateLimiterOptions,
): RequestHandler => {
	const { windowMs, max, prefix, message, skipRead = false } = options;

	const skipFn = (req: Request): boolean =>
		skipRead && ["GET", "HEAD", "OPTIONS"].includes(req.method);

	const sharedConfig = {
		windowMs,
		max,
		standardHeaders: true,
		legacyHeaders: false,
		skip: skipFn,
		handler: buildHandler(message),
	};

	const inMemoryLimiter = rateLimit(sharedConfig);

	let redisLimiter: ReturnType<typeof rateLimit> | null = null;

	const getRedisLimiter = (): ReturnType<typeof rateLimit> | null => {
		const client = getRedisClient();
		if (!client || client.status !== "ready") return null;

		if (!redisLimiter) {
			try {
				redisLimiter = rateLimit({
					...sharedConfig,
					// Disable the "created in request handler" validation because
					// lazy initialisation of the Redis-backed limiter is intentional:
					// the factory follows the spec's graceful-degradation pattern where
					// the Redis client may not be ready until after app startup.
					validate: { creationStack: false },
					store: new RedisStore({
						prefix,
						// Resolve the client on every command instead of capturing the
						// instance seen at construction time — if Redis disconnects and
						// reconnects with a fresh ioredis instance, the store must not
						// keep talking to the dead one. The per-request readiness check
						// above guarantees a ready client exists whenever this limiter
						// is selected; the guard below covers the narrow race where the
						// client is torn down mid-request.
						sendCommand: (...args: string[]) => {
							const current = getRedisClient();
							if (!current || current.status !== "ready") {
								return Promise.reject(
									new Error("Redis client unavailable for rate limiting"),
								);
							}
							return current.call(
								...(args as [string, ...string[]]),
							) as Promise<
								string | number | boolean | (string | number | boolean)[]
							>;
						},
					}),
				});
			} catch {
				// Store construction failed — fall back to the in-memory limiter.
				// redisLimiter remains null so getRedisLimiter() returns null and
				// the caller delegates to inMemoryLimiter.
			}
		}

		return redisLimiter;
	};

	return (req: Request, res: Response, next: NextFunction): void => {
		const limiter = getRedisLimiter() ?? inMemoryLimiter;
		limiter(req, res, next);
	};
};
