import { z } from "zod";
import { limitQuery, pageQuery } from "../common.schema.js";

const money = z.number().min(0, "Сумма не может быть отрицательной").max(1_000_000_000);

export const openShiftSchema = z.object({
  openingCash: money.default(0),
  notes: z.string().max(2000).optional(),
});

export const closeShiftSchema = z.object({
  closingCash: money,
  notes: z.string().max(2000).optional(),
});

export const shiftQuerySchema = z.object({
  status: z.enum(["open", "closed"]).optional(),
  userId: z.string().uuid().optional(),
  page: pageQuery,
  limit: limitQuery,
});

export type OpenShiftInput = z.infer<typeof openShiftSchema>;
export type CloseShiftInput = z.infer<typeof closeShiftSchema>;
export type ShiftQueryInput = z.infer<typeof shiftQuerySchema>;
