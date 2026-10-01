import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestData, getTokens, cleanupTestData, prisma, testTenantId, BASE_URL } from "./helpers.js";

// Склад: ручные корректировки остатка, журнал движений и список «мало на
// складе». Корректировка — это тоже движение, и журнал должен сходиться с
// остатком.

let admin: string;
let cashier: string;
let categoryId: string;
let seq = 0;

const call = async (method: string, path: string, token: string, body?: unknown) => {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
};

async function product(data: Record<string, unknown> = {}) {
  seq += 1;
  return prisma.product.create({
    data: { tenantId: testTenantId, categoryId, name: `Склад ${seq}`, sku: `INV-${seq}`, price: 10, costPrice: 4, trackInventory: true, ...data },
  });
}

const stock = async (id: string) => (await prisma.product.findUniqueOrThrow({ where: { id } })).currentStock;
const adjust = (id: string, quantity: number, token = admin) =>
  call("POST", `/inventory/${id}/adjust`, token, { quantity, reason: "Пересчёт" });

describe("Inventory", () => {
  beforeAll(async () => {
    await setupTestData();
    const tokens = await getTokens(BASE_URL);
    admin = tokens.adminToken;
    cashier = tokens.cashierToken;
    categoryId = (await prisma.category.findFirstOrThrow({ where: { tenantId: testTenantId } })).id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("adjusts stock both ways and records each change in the journal", async () => {
    const p = await product({ currentStock: 10 });

    expect((await adjust(p.id, 5)).status).toBe(200);
    expect((await adjust(p.id, -3)).status).toBe(200);
    expect(await stock(p.id)).toBe(12);

    const journal = await call("GET", `/inventory/movements?productId=${p.id}`, admin);
    const moves = (journal.body.data as any[]).map((m) => [m.type, m.quantity, m.reason]);
    expect(moves).toEqual(expect.arrayContaining([["in", 5, "Пересчёт"], ["out", 3, "Пересчёт"]]));

    const outOnly = await call("GET", `/inventory/movements?productId=${p.id}&type=out`, admin);
    expect(outOnly.body.data).toHaveLength(1);
  });

  it("refuses an adjustment that would take stock below zero, and writes nothing", async () => {
    const p = await product({ currentStock: 2 });

    const res = await adjust(p.id, -5);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/отрицательным/);
    expect(await stock(p.id)).toBe(2);
    expect(await prisma.inventoryMovement.count({ where: { productId: p.id } })).toBe(0);
  });

  it("converts an adjustment from the purchase unit, both ways", async () => {
    // Покупаем килограммами, продаём и храним граммами.
    const cheese = await product({ currentStock: 500, purchaseUnit: "кг", saleUnit: "г", conversionFactor: 1000 });

    await adjust(cheese.id, 2);
    expect(await stock(cheese.id)).toBe(2500);
    await adjust(cheese.id, -0.3);
    expect(await stock(cheese.id)).toBe(2200);
  });

  it("keeps grams when stock is counted in kilograms", async () => {
    const tea = await product({ currentStock: 1.234, saleUnit: "кг" });

    await adjust(tea.id, 0.001);

    // Округление до сотых превратило бы 1,235 кг в 1,24 — плюс 5 г из воздуха.
    expect(await stock(tea.id)).toBe(1.235);
  });

  it("adjusts through the product endpoint without float noise", async () => {
    const p = await product({ currentStock: 84.2 });

    const res = await call("POST", `/products/${p.id}/stock`, admin, { quantity: -1.24, reason: "Списание" });

    expect(res.status).toBe(200);
    expect(await stock(p.id)).toBe(82.96); // а не 82.96000000000001
  });

  it("does not let a cashier adjust stock", async () => {
    const p = await product({ currentStock: 5 });
    expect((await adjust(p.id, 1, cashier)).status).toBe(403);
    expect(await stock(p.id)).toBe(5);
  });

  it("lists as «мало на складе» only tracked, active products at or below their minimum", async () => {
    const low = await product({ name: "Аааа мало", currentStock: 1, minStock: 3 });
    const edge = await product({ name: "Аааб на грани", currentStock: 3, minStock: 3 });
    const plenty = await product({ name: "Аааа много", currentStock: 30, minStock: 3 });
    const untracked = await product({ name: "Аааа без учёта", currentStock: 0, minStock: 3, trackInventory: false });
    const archived = await product({ name: "Аааа в архиве", currentStock: 0, minStock: 3, isActive: false });

    const alerts = ((await call("GET", "/inventory/alerts", admin)).body.data as any[]).map((p) => p.id);
    expect(alerts).toEqual(expect.arrayContaining([low.id, edge.id]));
    for (const id of [plenty.id, untracked.id, archived.id]) expect(alerts).not.toContain(id);

    const page = await call("GET", "/inventory/stock?lowStock=true&limit=100", admin);
    const ids = (page.body.data as any[]).map((p) => p.id);
    expect(new Set(ids)).toEqual(new Set(alerts));
  });
});
