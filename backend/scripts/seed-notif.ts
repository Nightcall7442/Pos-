import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const tenant = await p.tenant.findFirst();
  if (!tenant) { console.log("No tenant"); return; }

  // Lower stock for some products
  await p.product.updateMany({
    where: { tenantId: tenant.id, trackInventory: true },
    data: { currentStock: 2 },
  });

  // Create some test orders
  for (let i = 1; i <= 5; i++) {
    await p.order.create({
      data: {
        tenantId: tenant.id,
        orderNumber: 1000 + i,
        status: ["pending", "confirmed", "preparing", "ready", "completed"][i - 1],
        subtotal: 10 * i,
        taxAmount: 1.5 * i,
        total: 11.5 * i,
      },
    });
  }

  console.log("Created 5 test orders and lowered stock");
}

main().catch(console.error).finally(() => p.$disconnect());
