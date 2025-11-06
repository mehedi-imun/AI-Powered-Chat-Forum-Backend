import logger from "../utils/logger";
import Redis from "ioredis";
import env from "./env";

let redisClient: Redis | null = null;

export const connectRedis = (): Redis => {
	if (redisClient) {
		return redisClient;
	}

	try {
		redisClient = new Redis(env.REDIS_URL, {
			maxRetriesPerRequest: 3,
			enableReadyCheck: true,
			retryStrategy(times) {
				const delay = Math.min(times * 50, 2000);
				return delay;
			},
		});

		redisClient.on("connect", () => {
			logger.info("✅ Redis connected successfully");
		});

		redisClient.on("error", (err) => {
			logger.error("❌ Redis connection error");
		});

		redisClient.on("ready", () => {
			logger.info("✅ Redis is ready to accept commands");
		});

		return redisClient;
	} catch (error) {
		logger.error("❌ Failed to connect to Redis");
		throw error;
	}
};

export const getRedisClient = (): Redis | null => {
	return redisClient;
};

export const disconnectRedis = async (): Promise<void> => {
	if (redisClient) {
		await redisClient.quit();
		logger.info("✅ Redis disconnected successfully");
		redisClient = null;
	}
};

export const cacheService = {
	async get(key: string): Promise<string | null> {
		if (!redisClient) return null;
		try {
			return await redisClient.get(key);
		} catch (error) {
			logger.error("Redis GET error");
			return null;
		}
	},

	async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
		if (!redisClient) return false;
		try {
			if (ttlSeconds) {
				await redisClient.setex(key, ttlSeconds, value);
			} else {
				await redisClient.set(key, value);
			}
			return true;
		} catch (error) {
			logger.error("Redis SET error");
			return false;
		}
	},

	async del(key: string): Promise<boolean> {
		if (!redisClient) return false;
		try {
			await redisClient.del(key);
			return true;
		} catch (error) {
			logger.error("Redis DEL error");
			return false;
		}
	},

	async exists(key: string): Promise<boolean> {
		if (!redisClient) return false;
		try {
			const result = await redisClient.exists(key);
			return result === 1;
		} catch (error) {
			logger.error("Redis EXISTS error");
			return false;
		}
	},

	async setJSON(
		key: string,
		value: any,
		ttlSeconds?: number,
	): Promise<boolean> {
		return this.set(key, JSON.stringify(value), ttlSeconds);
	},

	async getJSON<T>(key: string): Promise<T | null> {
		const value = await this.get(key);
		if (!value) return null;
		try {
			return JSON.parse(value) as T;
		} catch (error) {
			logger.error("Redis JSON parse error");
			return null;
		}
	},
};
