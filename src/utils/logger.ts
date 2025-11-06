import pino from "pino";
import pinoPretty from "pino-pretty";
import env from "../config/env";

const isDevelopment = env.NODE_ENV === "development";

let logger: pino.Logger;

if (isDevelopment) {
	const prettyStream = pinoPretty({
		colorize: true,
		translateTime: "SYS:HH:MM:ss",
		ignore: "pid,hostname",
		singleLine: false,
		messageFormat: "{msg}",
		customColors: "info:green,warn:yellow,error:red,debug:blue",
		levelFirst: true,
		hideObject: false,
	});

	logger = pino(
		{
			level: "debug",
			base: undefined,
		},
		prettyStream,
	);

	logger.info("🎨 Logger mode: Development (Pretty Console, No Files)");
} else {
	const fs = require("node:fs");
	const path = require("node:path");

	const logsDir = path.join(process.cwd(), "logs");
	if (!fs.existsSync(logsDir)) {
		fs.mkdirSync(logsDir, { recursive: true });
	}

	const errorStream = pino.destination({
		dest: path.join(logsDir, "error.log"),
		sync: false,
	});

	const combinedStream = pino.destination({
		dest: path.join(logsDir, "combined.log"),
		sync: false,
	});

	logger = pino({
		level: "info",
		base: {
			env: env.NODE_ENV,
		},
		timestamp: pino.stdTimeFunctions.isoTime,
		serializers: {
			err: pino.stdSerializers.err,
			error: pino.stdSerializers.err,
			req: pino.stdSerializers.req,
			res: pino.stdSerializers.res,
		},
	});

	const errorLogger = pino({ level: "error" }, errorStream);
	const combinedLogger = pino(combinedStream);

	const originalError = logger.error.bind(logger);
	logger.error = (obj: any, msg?: string, ...args: any[]) => {
		originalError(obj, msg, ...args);
		errorLogger.error(obj, msg, ...args);
		combinedLogger.error(obj, msg, ...args);
		return logger;
	};

	const originalInfo = logger.info.bind(logger);
	logger.info = (obj: any, msg?: string, ...args: any[]) => {
		originalInfo(obj, msg, ...args);
		combinedLogger.info(obj, msg, ...args);
		return logger;
	};

	const originalWarn = logger.warn.bind(logger);
	logger.warn = (obj: any, msg?: string, ...args: any[]) => {
		originalWarn(obj, msg, ...args);
		combinedLogger.warn(obj, msg, ...args);
		return logger;
	};

	const originalDebug = logger.debug.bind(logger);
	logger.debug = (obj: any, msg?: string, ...args: any[]) => {
		originalDebug(obj, msg, ...args);
		combinedLogger.debug(obj, msg, ...args);
		return logger;
	};
}

export const logInfo = (message: string, meta?: any) => {
	logger.info({ emoji: "ℹ️", ...meta }, message);
};

export const logError = (message: string, error?: any, meta?: any) => {
	logger.error({ emoji: "❌", error, ...meta }, message);
};

export const logWarn = (message: string, meta?: any) => {
	logger.warn({ emoji: "⚠️", ...meta }, message);
};

export const logDebug = (message: string, meta?: any) => {
	logger.debug({ emoji: "🐛", ...meta }, message);
};

export const logHttp = (message: string, meta?: any) => {
	logger.info({ emoji: "🌐", ...meta }, message);
};

export const createChildLogger = (context: Record<string, any>) => {
	return logger.child(context);
};

export default logger;
