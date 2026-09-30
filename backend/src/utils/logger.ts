import winston from "winston";
import { getEnv } from "../config/env.js";

const env = getEnv();

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "qwik-backend" },
  transports: [
    new winston.transports.File({
      filename: "error.log",
      level: "error",
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: "combined.log",
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

// The console is how a hosted container is observed (Railway shows nothing but
// its stdout): JSON lines in production, readable colour in development.
logger.add(
  new winston.transports.Console(
    env.NODE_ENV !== "production"
      ? { format: winston.format.combine(winston.format.colorize(), winston.format.simple()) }
      : {}
  )
);

export default logger;
