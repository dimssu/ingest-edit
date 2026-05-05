import pino, { type Logger, type LoggerOptions } from "pino";
import { env } from "@/lib/server/env";

const isDev = env.NODE_ENV !== "production";

const baseOptions: LoggerOptions = {
  level: env.LOG_LEVEL,
  base: { app: "ingest-edit" },
  timestamp: pino.stdTimeFunctions.isoTime,
};

const devOptions: LoggerOptions = {
  ...baseOptions,
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:HH:MM:ss.l",
      ignore: "pid,hostname",
    },
  },
};

export const logger: Logger = pino(isDev ? devOptions : baseOptions);

/**
 * Returns a child logger pre-bound to the given fields. Use this to attach
 * `jobId`, `userId`, `itemId`, etc. so every log line for a job is filterable.
 */
export function child(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}
