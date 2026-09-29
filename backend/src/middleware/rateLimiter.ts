import { Request } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { getEnv } from "../config/env.js";

// Every terminal and the admin panel reach the API through the same reverse
// proxy (Vite in dev, nginx in Docker), so a per-IP bucket is shared by the
// whole shop. Authenticated traffic is therefore bucketed per user; only
// unauthenticated requests fall back to the client IP.
// IPv6 clients rotate addresses inside their /64, so bucket by that prefix.
function ipKey(ip: string): string {
  if (!ip.includes(":")) return ip;
  const full = ip.replace(/^::ffff:/, "");
  if (!full.includes(":")) return full; // IPv4-mapped
  return full.split(":").slice(0, 4).join(":") + "::/64";
}

function userOrIpKey(req: Request): string {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const decoded = jwt.verify(header.slice(7), getEnv().JWT_SECRET) as { id?: string };
      if (decoded.id) return `user:${decoded.id}`;
    } catch {
      // invalid/expired token — fall through to the IP bucket
    }
  }
  return `ip:${ipKey(req.ip ?? "unknown")}`;
}

// 600 requests per minute per user — far above a busy terminal (a sale is
// ~3 requests), still low enough to smother a runaway script.
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  keyGenerator: userOrIpKey,
  message: { success: false, error: "Слишком много запросов, попробуйте через минуту" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Login/register: brute-force protection per IP.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: "Слишком много попыток входа, попробуйте позже" },
  standardHeaders: true,
  legacyHeaders: false,
});
