import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestData, getTokens, cleanupTestData, prisma, testTenantId, BASE_URL } from "./helpers.js";

// На SQLite писатель в базе один, и транзакции продажи, оплаты и прихода
// никогда не шли одновременно. На Postgres идут: две кассы, пробившие
// последнюю единицу товара в одну и ту же миллисекунду, обе прочитали бы
// «остаток 1» и обе продали бы. Эти тесты бьют по API параллельными запросами
// и проверяют итог в базе.

let token: string;
let categoryId: string;
let seq = 0;

const post = (path: string, body: unknown) =>
  fetch(`${BASE_URL}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

async function product(currentStock: number, price = 10) {
  seq += 1;
  return prisma.product.create({
    data: {
      tenantId: testTenantId,
      categoryId,
      name: `Товар для гонки ${seq}`,
      price,
      costPrice: 4,
      sku: `RACE-${seq}`,
      currentStock,
      trackInventory: true,
    },
  });
}

const checkout = (productId: string, quantity = 1, price = 10) =>
  post("/orders/checkout", {
    type: "takeaway",
    items: [{ productId, quantity }],
    expectedTotal: price * quantity,
    payment: { method: "cash" },
  });

async function settle(responses: Promise<Response>[]) {
  const all = await Promise.all(responses);
  const bodies = await Promise.all(all.map((r) => r.json() as Promise<any>));
  return all.map((r, i) => ({ ok: r.ok, status: r.status, body: bodies[i] }));
}

describe("concurrent writes on Postgres", () => {
  beforeAll(async () => {
    await setupTestData();
    const tokens = await getTokens(BASE_URL);
    token = tokens.adminToken;
    categoryId = (await prisma.category.findFirstOrThrow({ where: { tenantId: testTenantId } })).id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("never sells more than is in stock", async () => {
    const p = await product(3);

    const results = await settle(Array.from({ length: 10 }, () => checkout(p.id)));
    const sold = results.filter((r) => r.ok);
    const refused = results.filter((r) => !r.ok);

    expect(sold).toHaveLength(3);
    // Отказ — именно из-за остатка, а не из-за взаимной блокировки или таймаута.
    for (const r of refused) expect(r.body.error).toMatch(/Недостаточно товара/);

    const after = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.currentStock).toBe(0);
    // Журнал движений сходится с остатком: три списания, не больше.
    const out = await prisma.inventoryMovement.count({ where: { productId: p.id, type: "out" } });
    expect(out).toBe(3);
  });

  it("gives every order its own number", async () => {
    const p = await product(100);

    const results = await settle(Array.from({ length: 10 }, () => checkout(p.id)));
    for (const r of results) expect(r.ok, JSON.stringify(r.body)).toBe(true);

    const numbers = results.map((r) => r.body.data.orderNumber as number);
    expect(new Set(numbers).size).toBe(numbers.length);
    // Номера идут подряд, без пропусков.
    const sorted = [...numbers].sort((a, b) => a - b);
    expect(sorted[sorted.length - 1] - sorted[0]).toBe(numbers.length - 1);
  });

  it("takes one payment for an order paid twice at once", async () => {
    const p = await product(10);
    const created = await post("/orders", { type: "takeaway", items: [{ productId: p.id, quantity: 1 }] });
    expect(created.ok).toBe(true);
    const order = ((await created.json()) as any).data;

    const results = await settle(
      Array.from({ length: 5 }, () => post("/payments", { orderId: order.id, method: "cash", amount: order.total }))
    );

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const payments = await prisma.payment.findMany({ where: { orderId: order.id, status: "completed" } });
    expect(payments).toHaveLength(1);
    const paid = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(paid.status).toBe("completed");
  });

  // Продажи одной точки и так идут по очереди — их выстраивает строка
  // счётчика номеров заказов. А оплаты разных заказов идут по-настоящему
  // параллельно и списывают по техкарте один и тот же ингредиент: без
  // блокировки строки ингредиента часть списаний терялась бы.
  it("writes off a shared ingredient once per paid order", async () => {
    const milk = await product(100);
    seq += 1;
    const latte = await prisma.product.create({
      data: {
        tenantId: testTenantId,
        categoryId,
        name: `Латте ${seq}`,
        price: 10,
        costPrice: 3,
        sku: `LATTE-${seq}`,
        trackInventory: false,
        techCard: JSON.stringify([{ ingredientId: milk.id, quantity: 0.2 }]),
      },
    });

    const orders: { id: string; total: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const res = await post("/orders", { type: "takeaway", items: [{ productId: latte.id, quantity: 1 }] });
      orders.push(((await res.json()) as any).data);
    }

    const results = await settle(orders.map((o) => post("/payments", { orderId: o.id, method: "cash", amount: o.total })));
    for (const r of results) expect(r.ok, JSON.stringify(r.body)).toBe(true);

    const after = await prisma.product.findUniqueOrThrow({ where: { id: milk.id } });
    expect(after.currentStock).toBe(98);
  });

  it("does not lose a delivery that lands while the shop is selling", async () => {
    const p = await product(100);

    const results = await settle([
      ...Array.from({ length: 10 }, () => checkout(p.id)),
      post("/stock-receipts", { items: [{ productId: p.id, quantity: 50, costPrice: 4 }] }),
    ]);
    for (const r of results) expect(r.ok, JSON.stringify(r.body)).toBe(true);

    const after = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.currentStock).toBe(100 - 10 + 50);
  });
});
