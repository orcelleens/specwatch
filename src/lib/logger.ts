import pino from "pino";

// Create a singleton pino logger instance
const pinoLogger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
          },
        }
      : undefined,
});

// Wrapper that matches the API used in scheduler.ts: logger.info("message", { meta })
// Pino expects (object, message?) but we want (message, object?)
export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => pinoLogger.info(meta ?? {}, msg),
  debug: (msg: string, meta?: Record<string, unknown>) => pinoLogger.debug(meta ?? {}, msg),
  warn: (msg: string, meta?: Record<string, unknown>) => pinoLogger.warn(meta ?? {}, msg),
  error: (msg: string, meta?: Record<string, unknown>) => pinoLogger.error(meta ?? {}, msg),
};

export default logger;