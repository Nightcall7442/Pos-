import type { Prisma } from "@prisma/client";

// Everything here runs inside a caller-supplied transaction so that an order,
// its stock movements and its payment either all land or none do.
export type Tx = Prisma.TransactionClient;

export const round2 = (n: number): number => Math.round(n * 100) / 100;

// Weighted products (sold by gram) keep their stock in grams, so one cart line
// of `weightGrams` grams consumes that many units of stock; everything else
// consumes `quantity` pieces.
export function stockUnitsFor(item: { quantity: number; weightGrams?: number | null }): number {
  return item.weightGrams ? item.weightGrams : item.quantity;
}

export interface Reservation {
  productId: string;
  name: string;
  units: number;
}

// Decrement stock for tracked products with a re-check inside the transaction,
// so two terminals can't both sell the last unit. Throws if any product is short.
export async function reserveStock(
  tx: Tx,
  params: { tenantId: string; userId?: string; orderId: string; reservations: Reservation[] }
): Promise<void> {
  const { tenantId, userId, orderId, reservations } = params;
  for (const r of reservations) {
    const fresh = await tx.product.findUnique({ where: { id: r.productId } });
    if (!fresh || fresh.currentStock < r.units) {
      throw new Error(`Недостаточно товара «${fresh?.name || r.name}» на складе: осталось ${fresh?.currentStock ?? 0}`);
    }
    await tx.product.update({
      where: { id: r.productId },
      data: { currentStock: { decrement: r.units } },
    });
    await tx.inventoryMovement.create({
      data: {
        tenantId,
        productId: r.productId,
        type: "out",
        quantity: r.units,
        reason: `Резерв: заказ #${orderId.slice(0, 8)}`,
        referenceId: orderId,
        userId,
      },
    });
  }
}

// Reverse of reserveStock — used when an order is cancelled.
export async function releaseStock(
  tx: Tx,
  params: { tenantId: string; userId?: string; orderId: string; reservations: Reservation[] }
): Promise<void> {
  const { tenantId, userId, orderId, reservations } = params;
  for (const r of reservations) {
    await tx.product.update({
      where: { id: r.productId },
      data: { currentStock: { increment: r.units } },
    });
    await tx.inventoryMovement.create({
      data: {
        tenantId,
        productId: r.productId,
        type: "in",
        quantity: r.units,
        reason: `Отмена заказа #${orderId.slice(0, 8)} — снят резерв`,
        referenceId: orderId,
        userId,
      },
    });
  }
}

interface TechCardLine {
  ingredientId: string;
  quantity: number;
}

// A product's recipe lives either in the linked TechCard entity (what the admin
// UI writes via `techCardId`) or in the legacy per-product `techCard` JSON.
// Both are honoured; the linked card wins when present.
function recipeFor(product: { techCard: string | null; techCardRef?: { ingredients: string } | null }): TechCardLine[] {
  const raw = product.techCardRef?.ingredients ?? product.techCard ?? "[]";
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((l) => l && typeof l.ingredientId === "string" && Number(l.quantity) > 0)
      : [];
  } catch {
    return [];
  }
}

// Write off recipe ingredients for every item of a paid order. Ingredient stock
// is allowed to go negative — a wrong count in the pantry must not block a sale,
// and a negative balance is visible in the low-stock report for correction.
export async function deductTechCardIngredients(
  tx: Tx,
  params: { tenantId: string; userId?: string; orderId: string }
): Promise<void> {
  const { tenantId, userId, orderId } = params;
  const items = await tx.orderItem.findMany({
    where: { orderId },
    include: { product: { include: { techCardRef: { select: { ingredients: true } } } } },
  });

  for (const item of items) {
    for (const line of recipeFor(item.product)) {
      const ingredient = await tx.product.findFirst({ where: { id: line.ingredientId, tenantId } });
      if (!ingredient) continue;

      const units = round2(Number(line.quantity) * item.quantity);
      await tx.product.update({
        where: { id: ingredient.id },
        data: { currentStock: { decrement: units } },
      });
      await tx.inventoryMovement.create({
        data: {
          tenantId,
          productId: ingredient.id,
          type: "out",
          quantity: units,
          reason: `Списание по техкарте «${item.product.name}»: заказ #${orderId.slice(0, 8)}`,
          referenceId: orderId,
          userId,
        },
      });
    }
  }
}
