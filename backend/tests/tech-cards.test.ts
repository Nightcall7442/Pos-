import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestData, getTokens, cleanupTestData, prisma, testTenantId, BASE_URL } from "./helpers.js";

// Техкарты. README: «Рецепт блюда списывает ингредиенты в момент оплаты — с
// точностью до грамма. Поддерживаются и связанные техкарты, и старый
// JSON-формат внутри товара». Ингредиенты здесь учитываются в килограммах,
// и количества в техкарте — тоже в килограммах.

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

async function ingredient(name: string, currentStock: number, costPrice: number) {
  seq += 1;
  return prisma.product.create({
    data: { tenantId: testTenantId, categoryId, name, sku: `ING-${seq}`, price: 0, costPrice, currentStock, saleUnit: "кг", isIngredient: true },
  });
}

async function dish(name: string, extra: { techCardId?: string; techCard?: string } = {}) {
  seq += 1;
  return prisma.product.create({
    data: { tenantId: testTenantId, categoryId, name, sku: `DISH-${seq}`, price: 10, costPrice: 0, trackInventory: false, ...extra },
  });
}

const stock = async (id: string) => (await prisma.product.findUniqueOrThrow({ where: { id } })).currentStock;

const checkout = (productId: string, quantity: number) =>
  call("POST", "/orders/checkout", cashier, {
    type: "takeaway",
    items: [{ productId, quantity }],
    expectedTotal: 10 * quantity,
    payment: { method: "cash" },
  });

describe("Tech cards", () => {
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

  it("is created by a manager or admin, priced from its ingredients", async () => {
    const coffee = await ingredient("Кофе зерновой", 2, 200000);
    const res = await call("POST", "/tech-cards", admin, {
      name: "Эспрессо",
      ingredients: [{ ingredientId: coffee.id, quantity: 0.018, unit: "кг" }],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.totalCost).toBeCloseTo(3600, 6);
    expect((await call("POST", "/tech-cards", cashier, { name: "Нельзя" })).status).toBe(403);
  });

  it("refuses an ingredient that does not exist in the shop", async () => {
    const res = await call("POST", "/tech-cards", admin, {
      name: "С опечаткой",
      ingredients: [{ ingredientId: "00000000-0000-4000-8000-000000000000", quantity: 0.1, unit: "кг" }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ингредиент/i);
  });

  it("writes ingredients off at payment, times the quantity sold, to the gram", async () => {
    const milk = await ingredient("Молоко", 10, 12000);
    const sugar = await ingredient("Сахар", 1, 9000);
    const card = (
      await call("POST", "/tech-cards", admin, {
        name: "Латте",
        ingredients: [
          { ingredientId: milk.id, quantity: 0.2, unit: "кг" },
          { ingredientId: sugar.id, quantity: 0.004, unit: "кг" },
        ],
      })
    ).body.data;
    const latte = await dish("Латте", { techCardId: card.id });

    expect((await checkout(latte.id, 3)).status).toBe(201);

    expect(await stock(milk.id)).toBeCloseTo(10 - 0.6, 9);
    // 4 г сахара × 3 = 12 г. Округление до сотых (10 г) списало бы 10 г, а
    // одна порция (4 г) не списалась бы вовсе.
    expect(await stock(sugar.id)).toBeCloseTo(1 - 0.012, 9);

    expect((await checkout(latte.id, 1)).status).toBe(201);
    expect(await stock(sugar.id)).toBeCloseTo(1 - 0.016, 9);
  });

  it("writes off by the recipe kept inside the product (old format)", async () => {
    const flour = await ingredient("Мука", 5, 6000);
    const bun = await dish("Булочка", { techCard: JSON.stringify([{ ingredientId: flour.id, quantity: 0.08 }]) });

    expect((await checkout(bun.id, 2)).status).toBe(201);
    expect(await stock(flour.id)).toBeCloseTo(5 - 0.16, 9);
  });

  it("writes off only once the order is paid, and never for a cancelled one", async () => {
    const cream = await ingredient("Сливки", 3, 30000);
    const bun = await dish("Капучино", { techCard: JSON.stringify([{ ingredientId: cream.id, quantity: 0.05 }]) });

    const order = (await call("POST", "/orders", cashier, { type: "takeaway", items: [{ productId: bun.id, quantity: 1 }] })).body.data;
    expect(await stock(cream.id)).toBe(3);

    const cancelled = (await call("POST", "/orders", cashier, { type: "takeaway", items: [{ productId: bun.id, quantity: 1 }] })).body.data;
    expect((await call("POST", `/orders/${cancelled.id}/cancel`, admin)).status).toBe(200);
    expect(await stock(cream.id)).toBe(3);

    expect((await call("POST", "/payments", cashier, { orderId: order.id, method: "cash", amount: order.total })).status).toBe(201);
    expect(await stock(cream.id)).toBeCloseTo(3 - 0.05, 9);
  });

  // Пустая кладовая не должна останавливать продажу: минус виден в отчёте о
  // нехватке и правится приходом (комментарий в stock.helpers.ts).
  it("lets an ingredient go below zero rather than block the sale", async () => {
    const syrup = await ingredient("Сироп", 0.01, 50000);
    const drink = await dish("Лимонад", { techCard: JSON.stringify([{ ingredientId: syrup.id, quantity: 0.03 }]) });

    expect((await checkout(drink.id, 1)).status).toBe(201);
    expect(await stock(syrup.id)).toBeCloseTo(-0.02, 9);
  });

  it("copies, recalculates its cost, and hides when deleted", async () => {
    const tea = await ingredient("Чай листовой", 1, 100000);
    const card = (
      await call("POST", "/tech-cards", admin, { name: "Чай", ingredients: [{ ingredientId: tea.id, quantity: 0.005, unit: "кг" }] })
    ).body.data;

    const copy = await call("POST", `/tech-cards/${card.id}/copy`, admin);
    expect(copy.status).toBe(201);
    expect(copy.body.data.name).toBe("Чай (копия)");

    await prisma.product.update({ where: { id: tea.id }, data: { costPrice: 200000 } });
    const recalculated = await call("POST", `/tech-cards/${card.id}/recalculate`, admin);
    expect(recalculated.body.data.totalCost).toBeCloseTo(1000, 6);

    expect((await call("DELETE", `/tech-cards/${card.id}`, admin)).status).toBe(200);
    const list = await call("GET", "/tech-cards?limit=100", admin);
    expect((list.body.data as any[]).map((c) => c.id)).not.toContain(card.id);
  });
});
