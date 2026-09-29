import prisma from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { releaseStock, stockUnitsFor, type Reservation } from "../inventory/stock.helpers.js";

// Creating an order reserves stock. A terminal that crashes (or a cashier who
// walks away) between the order and its payment would otherwise hold that
// stock forever, making goods look sold out. Unpaid, untouched orders are
// therefore cancelled after a grace period and their reservation released.
export async function cancelStalePendingOrders(maxAgeMinutes: number): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

  const stale = await prisma.order.findMany({
    where: {
      status: "pending",
      createdAt: { lt: cutoff },
      payments: { none: { status: "completed" } },
    },
    include: { items: { include: { product: true } } },
  });

  let cancelled = 0;
  for (const order of stale) {
    const reservations: Reservation[] = order.items
      .filter((item) => item.product.trackInventory)
      .map((item) => ({ productId: item.productId, name: item.product.name, units: stockUnitsFor(item) }));

    try {
      await prisma.$transaction(async (tx) => {
        await releaseStock(tx, { tenantId: order.tenantId, orderId: order.id, reservations });
        await tx.order.update({
          where: { id: order.id },
          data: { status: "cancelled", notes: [order.notes, "Отменён автоматически: не оплачен"].filter(Boolean).join("\n") },
        });
        if (order.tableId) {
          await tx.table.update({ where: { id: order.tableId }, data: { status: "available" } });
        }
      });
      cancelled += 1;
    } catch (error) {
      logger.error("Failed to cancel stale order", {
        orderId: order.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (cancelled > 0) logger.info(`Cancelled ${cancelled} stale pending order(s)`);
  return cancelled;
}

export function startStaleOrderSweeper(maxAgeMinutes: number, intervalMs = 5 * 60 * 1000): NodeJS.Timeout {
  const timer = setInterval(() => {
    cancelStalePendingOrders(maxAgeMinutes).catch((error) =>
      logger.error("Stale order sweep failed", {
        message: error instanceof Error ? error.message : String(error),
      })
    );
  }, intervalMs);
  timer.unref();
  return timer;
}
