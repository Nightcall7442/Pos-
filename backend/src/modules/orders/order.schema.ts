import { z } from "zod";
import { limitQuery, pageQuery } from "../common.schema.js";

// Prices are never taken from the client. For weighted products (sold by
// gram) the client sends the portion weight in `grams`; the server prices it as
// rate × grams. `unitPrice` is accepted only for backwards compatibility and
// is ignored.
const orderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0).optional(),
  grams: z.number().positive().optional(),
  notes: z.string().optional(),
  modifierIds: z.array(z.string().uuid()).optional(),
});

export const createOrderSchema = z.object({
  branchId: z.string().uuid().optional(),
  tableId: z.string().uuid().optional(),
  cashShiftId: z.string().uuid().optional(),
  type: z.enum(["dine_in", "takeaway", "delivery", "online"]),
  items: z.array(orderItemSchema).min(1, "At least one item required"),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  notes: z.string().optional(),
  discountAmount: z.number().min(0).optional(),
});

// One-shot sale from the terminal: order + full payment in a single
// transaction. `expectedTotal` is what the cashier saw and collected; if the
// server's price differs, the whole thing is rejected (409) rather than
// accepting an underpayment.
export const checkoutSchema = createOrderSchema.extend({
  expectedTotal: z.number().min(0),
  payment: z.object({
    method: z.enum(["cash", "card", "qr", "online", "gift_card"]),
    tipAmount: z.number().min(0).optional(),
    transactionId: z.string().optional(),
    cardLastFour: z.string().length(4).optional(),
  }),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["confirmed", "preparing", "ready", "served", "completed", "cancelled"]),
});

export const orderQuerySchema = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
  branchId: z.string().uuid().optional(),
  tableId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(["createdAt", "total", "orderNumber"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: pageQuery,
  limit: limitQuery,
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type OrderQueryInput = z.infer<typeof orderQuerySchema>;
