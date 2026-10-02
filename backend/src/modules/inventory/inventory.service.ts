import type { Prisma } from "@prisma/client";
import type { InventoryQueryInput, MovementQueryInput } from "../common.schema.js";
import prisma from "../../config/database.js";
import { ci } from "../../utils/search.js";
import { lockStockRows, roundStock } from "./stock.helpers.js";
import { inTransaction } from "../../utils/transaction.js";
import { AppError, NotFoundError } from "../../utils/errors.js";

export class InventoryService {
  async getStock(tenantId: string, query: InventoryQueryInput) {
    const { lowStock, categoryId, search, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = { tenantId, isActive: true };
    if (categoryId) where.categoryId = categoryId;
    if (search) {
      where.OR = [
        { name: ci(search) },
        { sku: ci(search) },
      ];
    }

    // `lowStock` compares two columns (currentStock <= minStock), which Prisma
    // cannot express in a filter, so the rows are filtered in memory and the
    // page is cut afterwards.
    const allProducts = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minStock: true,
        costPrice: true,
        price: true,
        imageUrl: true,
        trackInventory: true,
        unit: true,
        purchaseUnit: true,
        saleUnit: true,
        conversionFactor: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });

    let products = allProducts;
    if (lowStock) {
      products = allProducts.filter((p) => p.trackInventory && p.currentStock <= p.minStock);
    }

    const paginated = products.slice(skip, skip + limit);
    return { products: paginated, total: products.length, page, limit };
  }

  async getMovements(tenantId: string, query: MovementQueryInput) {
    const { productId, type, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryMovementWhereInput = { tenantId };
    if (productId) where.productId = productId;
    if (type) where.type = type;

    const [movements, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          user: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.inventoryMovement.count({ where }),
    ]);

    return { movements, total, page, limit };
  }

  async adjustStock(tenantId: string, productId: string, quantity: number, reason: string, userId: string) {
    // Под блокировкой строки товара (lockStockRows) и в одной транзакции:
    // раньше остаток читался до транзакции, и корректировка, совпавшая с
    // продажей, затирала её списание.
    return inTransaction(async (tx) => {
      await lockStockRows(tx, tenantId, [productId]);
      const product = await tx.product.findFirst({ where: { id: productId, tenantId } });
      if (!product) throw new NotFoundError("Товар не найден");

      // Stock is kept in sale units. When the product is bought in a larger unit
      // (kg → g), the adjustment is expressed in the purchase unit and converted
      // in both directions — converting only additions used to make "+2 kg" add
      // 2000 g while "-2 kg" removed just 2 g.
      const factor = product.conversionFactor && product.purchaseUnit && product.saleUnit ? product.conversionFactor : 1;
      const adjustedQuantity = roundStock(quantity * factor);

      // До тысячных, как остаток везде (stock.helpers.roundStock): в
      // килограммах это грамм. round2 (до сотых) терял граммы — 1,234 кг
      // плюс 1 г становилось 1,23.
      const newStock = roundStock(product.currentStock + adjustedQuantity);
      if (newStock < 0) throw new AppError("Остаток не может стать отрицательным");

      const updated = await tx.product.update({
        where: { id: productId },
        data: { currentStock: newStock },
      });
      await tx.inventoryMovement.create({
        data: {
          tenantId,
          productId,
          type: quantity > 0 ? "in" : "out",
          quantity: Math.abs(adjustedQuantity),
          reason,
          userId,
        },
      });

      return updated;
    });
  }

  async getLowStockAlerts(tenantId: string) {
    const products = await prisma.product.findMany({
      where: {
        tenantId,
        trackInventory: true,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minStock: true,
        category: { select: { name: true } },
      },
      orderBy: { currentStock: "asc" },
    });

    return products.filter((p) => p.currentStock <= p.minStock);
  }
}

export const inventoryService = new InventoryService();
