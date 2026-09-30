import { z } from "zod";

export const catalogLookupSchema = z.object({
  code: z.string().trim().min(1).max(32),
});

// A product added by scanning: what the catalogue suggested (the client may
// have edited it) plus what only the shop knows — the price.
export const catalogAddSchema = z.object({
  barcode: z.string().trim().regex(/^\d{4,14}$/, "Штрихкод — только цифры"),
  name: z.string().trim().min(1).max(160),
  price: z.number().min(0),
  costPrice: z.number().min(0).optional(),
  categoryId: z.string().uuid().optional(),
  // A shelf by name ("Напитки"): found among the shop's categories or created.
  categoryName: z.string().trim().min(1).max(60).optional(),
  // Sold by the kilogram: price and stock are per kg.
  weighed: z.boolean().optional(),
  // Stock on hand. Left out, the shop simply sells it without counting.
  stock: z.number().min(0).optional(),
});

export type CatalogAddInput = z.infer<typeof catalogAddSchema>;
