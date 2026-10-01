import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  UPLOAD_DIR: z.string().default("./uploads"),
  MAX_FILE_SIZE: z.coerce.number().default(5242880),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  LOG_LEVEL: z.string().default("info"),
  // Unpaid orders hold a stock reservation; after this many minutes they are
  // cancelled automatically and the stock is returned.
  PENDING_ORDER_TTL_MINUTES: z.coerce.number().int().min(1).default(30),
  // Barcodes the shipped catalogue does not know are looked up live on Open Food
  // Facts (and its sister catalogues). OFF_BASE_URL sends every such lookup to
  // one server instead — the tests stand a stub in for the real thing.
  CATALOG_LIVE_LOOKUP: z.enum(["on", "off"]).default("on"),
  OFF_BASE_URL: z.string().url().optional(),
  // The national catalogue of Uzbekistan (tasnif.soliq.uz) is asked the same way; tests stub it too.
  TASNIF_BASE_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env;

export function getEnv(): Env {
  if (!_env) {
    _env = envSchema.parse(process.env);
  }
  return _env;
}
