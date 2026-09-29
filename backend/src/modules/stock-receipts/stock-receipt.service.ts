import prisma from "../../config/database.js";
import type { CreateStockReceiptInput } from "./stock-receipt.schema.js";
import { optionalDateFilter, tenantTimeZone } from "../../utils/dates.js";
import { AppError, NotFoundError } from "../../utils/errors.js";
import { round2 } from "../inventory/stock.helpers.js";

function computeSalePrice(costPrice: number, markupPercent: number): number {
  const price = costPrice * (1 + markupPercent / 100);
  return Math.round(price * 100) / 100;
}

/**
 * Decides what a receipt line does to the product's sale price.
 *
 * A markup of 0% is not a markup — it is an unconfigured one, and
 * `cost × (1 + 0/100)` is exactly the cost. Repricing from it silently turned
 * every shelf price into the purchase price, so the shop sold at zero margin
 * after a few deliveries. Now a price is only ever written when it is known:
 * an explicit one from the form, or a real (> 0) markup. Otherwise the caller
 * is told what is missing instead of the margin quietly disappearing.
 *
 * Returns the new price, or null when the current price must be left alone.
 */
function resolveSalePrice(
  item: { costPrice: number; updateSalePrice: boolean; salePrice?: number },
  context: { productName: string; markupPercent: number; isNewProduct: boolean }
): number | null {
  if (item.salePrice !== undefined && item.salePrice !== null) return item.salePrice;

  const hasMarkup = context.markupPercent > 0;
  if (item.updateSalePrice && hasMarkup) return computeSalePrice(item.costPrice, context.markupPercent);

  if (context.isNewProduct || item.updateSalePrice) {
    throw new AppError(
      `«${context.productName}»: наценка категории 0% — укажите цену продажи или задайте наценку категории`
    );
  }

  return null;
}

export class StockReceiptService {
  /**
   * Books a delivery: resolves (or creates) every product, writes the receipt
   * document, raises stock and records the movements — all inside one
   * transaction. It used to run as a sequence of separate writes, so a failure
   * half-way through (an unpriceable line, for example) left a receipt
   * document behind with no stock movement against it.
   */
  async create(tenantId: string, userId: string, data: CreateStockReceiptInput) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const defaultMarkup = tenant?.defaultMarkupPercent ?? 0;

    const receiptId = await prisma.$transaction(async (tx) => {
      const newCategoryCache = new Map<string, string>();
      const lines: {
        productId: string;
        quantity: number;
        costPrice: number;
        /** null = leave the current shelf price alone. */
        newPrice: number | null;
      }[] = [];

      for (const item of data.items) {
        let productId = item.productId;
        let createdNow = false;

        if (!productId && item.newProduct) {
          let categoryId = item.newProduct.categoryId;

          if (!categoryId && item.newProduct.newCategoryName) {
            const name = item.newProduct.newCategoryName.trim();
            const key = name.toLowerCase();
            if (newCategoryCache.has(key)) {
              categoryId = newCategoryCache.get(key);
            } else {
              const existing = await tx.category.findFirst({ where: { tenantId, name } });
              categoryId =
                existing?.id ??
                (await tx.category.create({ data: { tenantId, name, markupPercent: defaultMarkup } })).id;
              newCategoryCache.set(key, categoryId);
            }
          } else if (categoryId) {
            const owned = await tx.category.findFirst({ where: { id: categoryId, tenantId } });
            if (!owned) throw new NotFoundError("Категория не найдена");
          }

          const category = categoryId ? await tx.category.findUnique({ where: { id: categoryId } }) : null;
          const markupPercent = category?.markupPercent ?? defaultMarkup;
          const price = resolveSalePrice(
            { costPrice: item.costPrice, updateSalePrice: true, salePrice: item.salePrice },
            { productName: item.newProduct.name.trim(), markupPercent, isNewProduct: true }
          )!;

          const created = await tx.product.create({
            data: {
              tenantId,
              categoryId,
              name: item.newProduct.name.trim(),
              unit: item.newProduct.unit || "piece",
              costPrice: item.costPrice,
              price,
              currentStock: 0,
              trackInventory: true,
            },
          });
          productId = created.id;
          createdNow = true;
        }

        if (!productId) throw new AppError("Не указан товар для позиции прихода");

        const product = await tx.product.findFirst({
          where: { id: productId, tenantId },
          include: { category: true },
        });
        if (!product) throw new NotFoundError("Товар не найден");

        const markupPercent = product.category?.markupPercent ?? defaultMarkup;
        lines.push({
          productId,
          quantity: item.quantity,
          costPrice: item.costPrice,
          // A product created by this receipt was just priced above.
          newPrice: createdNow
            ? null
            : resolveSalePrice(
                {
                  costPrice: item.costPrice,
                  updateSalePrice: item.updateSalePrice ?? false,
                  salePrice: item.salePrice,
                },
                { productName: product.name, markupPercent, isNewProduct: false }
              ),
        });
      }

      const totalAmount = round2(lines.reduce((sum, l) => sum + l.quantity * l.costPrice, 0));

      const receipt = await tx.stockReceipt.create({
        data: {
          tenantId,
          userId,
          supplierName: data.supplierName,
          invoiceNumber: data.invoiceNumber,
          totalAmount,
          notes: data.notes,
          items: {
            create: lines.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              costPrice: l.costPrice,
              totalCost: round2(l.quantity * l.costPrice),
            })),
          },
        },
      });

      for (const line of lines) {
        await tx.product.update({
          where: { id: line.productId },
          data: {
            currentStock: { increment: line.quantity },
            costPrice: line.costPrice,
            ...(line.newPrice !== null ? { price: line.newPrice } : {}),
          },
        });
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            productId: line.productId,
            type: "in",
            quantity: line.quantity,
            reason: `Приход #${receipt.id.slice(0, 8)}`,
            referenceId: receipt.id,
            userId,
          },
        });
      }

      return receipt.id;
    });

    return this.findById(tenantId, receiptId);
  }

  async findAll(tenantId: string, query: any) {
    const { page = 1, limit = 20, dateFrom, dateTo, supplierName } = query;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    const createdAt = optionalDateFilter(dateFrom, dateTo, await tenantTimeZone(tenantId));
    if (createdAt) where.createdAt = createdAt;
    if (supplierName) where.supplierName = { contains: supplierName };

    const [receipts, total] = await Promise.all([
      prisma.stockReceipt.findMany({
        where,
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
          user: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.stockReceipt.count({ where }),
    ]);

    return { receipts, total, page, limit };
  }

  async findById(tenantId: string, id: string) {
    const receipt = await prisma.stockReceipt.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, volume: true } },
          },
        },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!receipt) throw new NotFoundError("Приход не найден");
    return receipt;
  }

  async delete(tenantId: string, id: string, userId?: string) {
    const receipt = await prisma.stockReceipt.findFirst({ where: { id, tenantId } });
    if (!receipt) throw new NotFoundError("Приход не найден");

    const items = await prisma.stockReceiptItem.findMany({ where: { receiptId: id } });

    // Reversing a receipt is a stock movement of its own: the decrement is
    // recorded so the movement journal still reconciles with the balance
    // (and is allowed to go negative if the goods were already sold).
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { decrement: item.quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            productId: item.productId,
            type: "out",
            quantity: item.quantity,
            reason: `Отмена прихода #${id.slice(0, 8)}`,
            referenceId: id,
            userId,
          },
        });
      }
      await tx.stockReceipt.delete({ where: { id } });
    });

    return { message: "Receipt deleted" };
  }
}

export const stockReceiptService = new StockReceiptService();
