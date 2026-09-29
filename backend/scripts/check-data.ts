import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const orders = await p.order.count();
  const products = await p.product.findMany({ where: { trackInventory: true }, select: { name: true, currentStock: true } });
  console.log("Orders:", orders);
  console.log("Tracked products:", JSON.stringify(products, null, 2));
}
main().catch(console.error).finally(() => p.$disconnect());
