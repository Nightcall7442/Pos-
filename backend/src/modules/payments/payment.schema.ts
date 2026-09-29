import { z } from "zod";

export const createPaymentSchema = z.object({
  orderId: z.string().uuid(),
  method: z.enum(["cash", "card", "qr", "online", "split", "gift_card"]),
  amount: z.number().min(0.01),
  // A payment that leaves a balance is refused unless the caller says so
  // explicitly — otherwise a stale client total silently records an underpaid
  // order as a finished sale.
  allowPartial: z.boolean().optional(),
  tipAmount: z.number().min(0).optional(),
  transactionId: z.string().optional(),
  cardLastFour: z.string().length(4).optional(),
});

export const refundPaymentSchema = z.object({
  reason: z.string().min(1),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;
