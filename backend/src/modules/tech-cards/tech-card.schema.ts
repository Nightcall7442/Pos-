import { z } from "zod";
import { booleanQuery, limitQuery, pageQuery } from "../common.schema.js";

const techCardIngredientSchema = z.object({
  ingredientId: z.string().uuid(),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  grossWeight: z.number().positive().optional(),
  netWeight: z.number().positive().optional(),
});

export const createTechCardSchema = z.object({
  name: z.string().min(1),
  ingredients: z.array(techCardIngredientSchema).optional(),
  output: z.number().min(0).optional(),
  unit: z.string().optional(),
});

export const updateTechCardSchema = createTechCardSchema.partial();

export const techCardQuerySchema = z.object({
  search: z.string().optional(),
  isActive: booleanQuery.optional(),
  sort: z.enum(["name", "totalCost", "createdAt"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: pageQuery,
  limit: limitQuery,
});

export type CreateTechCardInput = z.infer<typeof createTechCardSchema>;
export type UpdateTechCardInput = z.infer<typeof updateTechCardSchema>;
export type TechCardQueryInput = z.infer<typeof techCardQuerySchema>;
