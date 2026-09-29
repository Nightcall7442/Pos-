import { z } from "zod";

const newProductSchema = z
  .object({
    name: z.string().min(1),
    categoryId: z.string().uuid().optional(),
    newCategoryName: z.string().min(1).optional(),
    unit: z.string().optional(),
  })
  .refine((d) => !!d.categoryId || !!d.newCategoryName, {
    message: "Укажите категорию (categoryId или newCategoryName)",
  });

const stockReceiptItemSchema = z
  .object({
    productId: z.string().uuid().optional(),
    newProduct: newProductSchema.optional(),
    quantity: z.number().positive(),
    costPrice: z.number().min(0),
    // Recomputing the sale price from cost × markup is opt-in: a receipt must
    // not silently reprice goods that are already on the menu. New products
    // created by the receipt always get a computed price.
    updateSalePrice: z.boolean().optional(),
    salePrice: z.number().min(0).optional(),
  })
  .refine((d) => !!d.productId || !!d.newProduct, {
    message: "Укажите productId или newProduct",
  });

export const createStockReceiptSchema = z.object({
  supplierName: z.string().optional(),
  invoiceNumber: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(stockReceiptItemSchema).min(1),
});

export type CreateStockReceiptInput = z.infer<typeof createStockReceiptSchema>;
