import { z } from "zod";

// Query strings carry booleans as "true"/"false"; z.coerce.boolean() would
// turn the string "false" into true, so parse them explicitly.
export const booleanQuery = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((v) => v === true || v === "true" || v === "1");

export const pageQuery = z.coerce.number().int().min(1).optional();
export const limitQuery = z.coerce.number().int().min(1).max(200).optional();

export const adjustStockSchema = z.object({
  quantity: z.number().refine((v) => v !== 0, "quantity must not be 0"),
  reason: z.string().min(1).max(500),
});

export const reorderCategoriesSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export const reportQuerySchema = z.object({
  dateFrom: z.string().min(1, "dateFrom is required"),
  dateTo: z.string().min(1, "dateTo is required"),
});

export const paymentQuerySchema = z.object({
  method: z.enum(["cash", "card", "qr", "online", "split", "gift_card"]).optional(),
  status: z.enum(["pending", "completed", "refunded", "failed"]).optional(),
  orderId: z.string().uuid().optional(),
  page: pageQuery,
  limit: limitQuery,
});

export const paymentSummaryQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const inventoryQuerySchema = z.object({
  lowStock: booleanQuery.optional(),
  categoryId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  page: pageQuery,
  limit: limitQuery,
});

export const movementQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  type: z.enum(["in", "out"]).optional(),
  page: pageQuery,
  limit: limitQuery,
});

export const auditQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  entityType: z.string().max(64).optional(),
  action: z.string().max(64).optional(),
  page: pageQuery,
  limit: limitQuery,
});

export const stockReceiptQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  supplierName: z.string().max(200).optional(),
  page: pageQuery,
  limit: limitQuery,
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;
export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
