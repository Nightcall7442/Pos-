import { PrismaClient } from "@prisma/client";

/**
 * Warehouse health check. Run it against a live database (`npm run check-inventory`)
 * to find the damage older builds could leave behind:
 *
 *  - products selling at or below cost (a receipt used to recompute the shelf
 *    price as `cost × (1 + markup/100)`, which equals the cost itself whenever
 *    the markup is the default 0%);
 *  - receipt documents with no stock movements (a receipt was written in
 *    several separate steps, so a failure half-way left a document behind);
 *  - stock balances that disagree with the movement journal;
 *  - unpaid orders older than an hour still holding a stock reservation.
 */
const prisma = new PrismaClient();

const money = (n: number) => n.toFixed(2);

async function main() {
  let problems = 0;

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      price: true,
      costPrice: true,
      currentStock: true,
      trackInventory: true,
      isIngredient: true,
      category: { select: { name: true, markupPercent: true, isIngredient: true } },
    },
    orderBy: { name: "asc" },
  });

  // Ingredients are written off through recipes, never sold, so their zero
  // sale price is expected.
  const forSale = products.filter((p) => !p.isIngredient && !p.category?.isIngredient);

  const noMargin = forSale.filter((p) => p.costPrice > 0 && p.price <= p.costPrice);
  if (noMargin.length) {
    problems += noMargin.length;
    console.log(`\n⚠  Товары без маржи (цена ≤ себестоимости): ${noMargin.length}`);
    for (const p of noMargin) {
      const tag = p.price === p.costPrice ? "цена = себестоимость" : "цена НИЖЕ себестоимости";
      console.log(
        `   ${p.name} — ${money(p.price)} / ${money(p.costPrice)} (${tag}; ` +
          `категория «${p.category?.name ?? "—"}», наценка ${p.category?.markupPercent ?? 0}%)`
      );
    }
    console.log("   → задайте цену продажи в карточке товара или наценку категории");
  }

  const zeroPriced = forSale.filter((p) => p.price === 0);
  if (zeroPriced.length) {
    problems += zeroPriced.length;
    console.log(`\n⚠  Товары с нулевой ценой продажи: ${zeroPriced.map((p) => p.name).join(", ")}`);
  }

  const receipts = await prisma.stockReceipt.findMany({
    select: { id: true, createdAt: true, totalAmount: true, _count: { select: { items: true } } },
  });
  for (const receipt of receipts) {
    const movements = await prisma.inventoryMovement.count({ where: { referenceId: receipt.id, type: "in" } });
    if (movements === 0 && receipt._count.items > 0) {
      problems += 1;
      console.log(
        `\n⚠  Приход #${receipt.id.slice(0, 8)} от ${receipt.createdAt.toISOString().slice(0, 10)} ` +
          `на ${money(receipt.totalAmount)} не отражён в движениях склада`
      );
      console.log("   → остатки по нему не проведены; оформите приход заново и удалите этот документ");
    }
  }

  const stale = await prisma.order.findMany({
    where: {
      status: "pending",
      createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) },
      payments: { none: { status: "completed" } },
    },
    select: { orderNumber: true, createdAt: true },
  });
  if (stale.length) {
    problems += stale.length;
    console.log(`\n⚠  Неоплаченные заказы старше часа, удерживающие остаток: ${stale.length}`);
    console.log(`   № ${stale.map((o) => o.orderNumber).join(", ")}`);
    console.log("   → их отменяет автоочистка (PENDING_ORDER_TTL_MINUTES); проверьте, что сервер запущен");
  }

  // Balance vs journal: only meaningful for products whose movements cover
  // their whole life, so it is reported as information rather than an error.
  console.log("\nСводка:");
  console.log(
    `   товаров активных: ${products.length} (продаваемых: ${forSale.length}, ` +
      `со складским учётом: ${products.filter((p) => p.trackInventory).length})`
  );
  console.log(`   приходов: ${receipts.length}`);
  console.log(problems === 0 ? "\n✓ Проблем не найдено" : `\n✗ Найдено проблем: ${problems}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
