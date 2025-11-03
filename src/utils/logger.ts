import pino from "pino";
import pinoPretty from "pino-pretty";
import env from "../config/env";

const prettyStream = pinoPretty({
  colorize: true,
  translateTime: "SYS:HH:MM:ss",
  ignore: "pid,hostname",
  singleLine: false,
  messageFormat: "{msg}",
  customColors: "info:green,warn:yellow,error:red,debug:blue",
  levelFirst: false,
  hideObject: false,
});

// Pino configuration
const logger = pino(
  {
    level: env.NODE_ENV === "development" ? "debug" : "info",

    // Base configuration
    base: {
      env: env.NODE_ENV,
    },

    // Timestamp
    timestamp: pino.stdTimeFunctions.isoTime,

    // Serializers for error objects
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },

    // Format errors
    formatters: {
      level: (label) => {
        return { level: label };
      },
      bindings: (bindings) => {
        return {
          pid: bindings.pid,
          host: bindings.hostname,
        };
      },
    },
  },
  env.NODE_ENV === "development" ? prettyStream : undefined
);

// File transports for production (using pino streams)
if (env.NODE_ENV === "production") {
  const fs = require("fs");
  const path = require("path");

  // Ensure logs directory exists
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

  const errorLogger = pino({ level: "error" }, errorStream);
  const combinedLogger = pino(combinedStream);

  // Intercept and duplicate error logs
  const originalError = logger.error.bind(logger);
  logger.error = (obj: any, msg?: string, ...args: any[]) => {
    originalError(obj, msg, ...args);
    errorLogger.error(obj, msg, ...args);
    combinedLogger.error(obj, msg, ...args);
    return logger;
  };

  // Intercept all logs for combined file
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

// Helper functions (compatible with existing codebase)
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

// Export logger instance
export default logger;
