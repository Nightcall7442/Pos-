import { z } from "zod";

export const createTableSchema = z.object({
  number: z.string().min(1),
  capacity: z.number().int().min(1).max(100),
  branchId: z.string().uuid().optional(),
  zone: z.string().optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
});

export const updateTableSchema = createTableSchema.partial();

export const updateTableStatusSchema = z.object({
  status: z.enum(["available", "occupied", "reserved", "maintenance"]),
});

export type CreateTableInput = z.infer<typeof createTableSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
export type UpdateTableStatusInput = z.infer<typeof updateTableStatusSchema>;
