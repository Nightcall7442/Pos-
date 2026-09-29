import { Request, Response, NextFunction } from "express";
import { auditService } from "../modules/audit/audit.service.js";
import { logger } from "../utils/logger.js";

// Fields that must never reach the audit table.
const REDACTED = new Set([
  "password",
  "passwordHash",
  "currentPassword",
  "newPassword",
  "pin",
  "refreshToken",
  "accessToken",
]);

function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== "object" || depth > 4) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = REDACTED.has(key) ? "***" : sanitize(v, depth + 1);
  }
  return out;
}

function serialize(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const json = JSON.stringify(sanitize(value));
  // Keep one entry from ballooning the table on a large payload.
  return json && json.length > 8000 ? `${json.slice(0, 8000)}…` : json;
}

/**
 * Records a successful mutation in the audit table: who did what, from where,
 * and the resulting payload (falling back to the request body when the
 * response carries nothing useful, e.g. a delete).
 */
export function auditLog(action: string, entityType?: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      if (req.user && res.statusCode >= 200 && res.statusCode < 300 && body?.success !== false) {
        auditService
          .log({
            tenantId: req.user.tenantId,
            userId: req.user.id,
            action,
            entityType,
            entityId: (req.params.id as string | undefined) || body?.data?.id,
            newValue: serialize(body?.data ?? req.body),
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          })
          .catch((error) =>
            logger.error("Audit write failed", {
              action,
              message: error instanceof Error ? error.message : String(error),
            })
          );
      }
      return originalJson(body);
    };

    next();
  };
}
