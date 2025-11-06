import dotenv from "dotenv";

dotenv.config();

interface EnvConfig {
	PORT: string;
	DATABASE_URL: string;
	FRONTEND_URL: string;
	NODE_ENV: "development" | "production" | "test";

	JWT_SECRET: string;
	JWT_EXPIRES_IN: string;
	JWT_REFRESH_SECRET: string;
	JWT_REFRESH_EXPIRES_IN: string;

	REDIS_URL: string;

	RABBITMQ_URL: string;

	SMTP_HOST: string;
	SMTP_PORT: number;
	SMTP_USER: string;
	SMTP_PASSWORD: string;
	EMAIL_FROM: string;

	RATE_LIMIT_WINDOW_MS: number;
	RATE_LIMIT_MAX_REQUESTS: number;

	OPENAI_API_KEY?: string;
	AI_MODEL?: string;

	OPENROUTER_API_KEY?: string;
	OPENROUTER_MODEL?: string;
	SITE_URL?: string;
	SITE_NAME?: string;

	WEBHOOK_SECRET?: string;
}

const loadEnvVariables = (): EnvConfig => {
	const requiredEnvVars: string[] = [
		"NODE_ENV",
		"PORT",
		"FRONTEND_URL",
		"DATABASE_URL",
		"JWT_SECRET",
		"JWT_EXPIRES_IN",
		"JWT_REFRESH_SECRET",
		"JWT_REFRESH_EXPIRES_IN",
		"REDIS_URL",
		"RABBITMQ_URL",
		"SMTP_HOST",
		"SMTP_PORT",
		"SMTP_USER",
		"SMTP_PASSWORD",
		"EMAIL_FROM",
		"RATE_LIMIT_WINDOW_MS",
		"RATE_LIMIT_MAX_REQUESTS",
		"OPENROUTER_API_KEY",
		"OPENROUTER_MODEL",
		"SITE_URL",
		"SITE_NAME",
	];

	requiredEnvVars.forEach((key) => {
		if (!process.env[key]) {
			throw new Error(`Missing required environment variable: ${key}`);
		}
	});

	return {
		PORT: process.env.PORT!,
		DATABASE_URL: process.env.DATABASE_URL!,
		FRONTEND_URL: process.env.FRONTEND_URL!,
		NODE_ENV: process.env.NODE_ENV as "development" | "production" | "test",

		JWT_SECRET: process.env.JWT_SECRET!,
		JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN!,
		JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
		JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN!,

		REDIS_URL: process.env.REDIS_URL!,

		RABBITMQ_URL: process.env.RABBITMQ_URL!,

		SMTP_HOST: process.env.SMTP_HOST!,
		SMTP_PORT: parseInt(process.env.SMTP_PORT!, 10),
		SMTP_USER: process.env.SMTP_USER!,
		SMTP_PASSWORD: process.env.SMTP_PASSWORD!,
		EMAIL_FROM: process.env.EMAIL_FROM!,

		RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS!, 10),
		RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS!, 10),

		OPENAI_API_KEY: process.env.OPENAI_API_KEY,
		AI_MODEL: process.env.AI_MODEL,

		OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
		OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
		SITE_URL: process.env.SITE_URL,
		SITE_NAME: process.env.SITE_NAME,

		WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
	};
};

const env = loadEnvVariables();

export default env;
