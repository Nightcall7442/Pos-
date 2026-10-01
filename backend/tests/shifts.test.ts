import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { setupTestData, getTokens, cleanupTestData, prisma, testTenantId, BASE_URL } from "./helpers.js";

// Смена — это деньги кассира: сколько положил в ящик утром, сколько продал
// наличными, картой и по QR, сколько должно быть в ящике вечером и на сколько
// не сошлось. До этих тестов раздел не проверялся ничем.

let admin: string;
let cashier: string;
let cashier2: string;
let manager: string;
let productId: string;

const api = async (path: string, token: string, body?: unknown) => {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
};

async function staff(email: string, role: string): Promise<string> {
  await prisma.user.create({
    data: { tenantId: testTenantId, email, passwordHash: await bcrypt.hash("password123", 10), firstName: role, lastName: "Test", role },
  });
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });
  return ((await res.json()) as any).data.accessToken;
}

// Продажа на кассе на 10 (цена товара) в указанную смену.
async function sell(token: string, cashShiftId: string, method: "cash" | "card" | "qr") {
  const res = await api("/orders/checkout", token, {
    type: "takeaway",
    cashShiftId,
    items: [{ productId, quantity: 1 }],
    expectedTotal: 10,
    payment: { method },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.data as { id: string };
}

async function refund(orderId: string) {
  const payment = await prisma.payment.findFirstOrThrow({ where: { orderId, status: "completed" } });
  const res = await api(`/payments/${payment.id}/refund`, admin, { reason: "Покупатель вернул" });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
}

const open = (token: string, openingCash: number) => api("/cash-shifts/open", token, { openingCash });
const current = async (token: string) => (await api("/cash-shifts/current", token)).body.data;

describe("Cash shifts", () => {
  beforeAll(async () => {
    await setupTestData();
    const tokens = await getTokens(BASE_URL);
    admin = tokens.adminToken;
    cashier = tokens.cashierToken;
    cashier2 = await staff("cashier2@test.com", "cashier");
    manager = await staff("manager@test.com", "manager");
    const category = await prisma.category.findFirstOrThrow({ where: { tenantId: testTenantId } });
    productId = (
      await prisma.product.create({
        data: { tenantId: testTenantId, categoryId: category.id, name: "Чай", price: 10, costPrice: 3, sku: "TEA-1", currentStock: 1000, trackInventory: true },
      })
    ).id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("opens a shift with the cash in the drawer, one per cashier", async () => {
    const first = await open(cashier, 50000);
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ status: "open", openingCash: 50000 });

    const again = await open(cashier, 100);
    expect(again.status).toBe(409);
    expect(again.body.error).toMatch(/уже есть открытая смена/);
  });

  it("lets only one of two simultaneous opens through", async () => {
    const [a, b] = await Promise.all([open(cashier2, 100), open(cashier2, 100)]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect([a, b].find((r) => r.status === 409)!.body.error).toMatch(/уже есть открытая смена/);
    expect(await prisma.cashShift.count({ where: { tenantId: testTenantId, status: "open", user: { email: "cashier2@test.com" } } })).toBe(1);
  });

  it("totals the open shift live, by payment method", async () => {
    const shift = await current(cashier);
    await sell(cashier, shift.id, "cash");
    await sell(cashier, shift.id, "cash");
    await sell(cashier, shift.id, "card");
    await sell(cashier, shift.id, "qr");

    const live = await current(cashier);
    expect(live).toMatchObject({
      totalCashSales: 20,
      totalCardSales: 10,
      totalQrSales: 10,
      totalSales: 40,
      expectedCash: 50000 + 20,
    });
    expect(live.orders).toHaveLength(4);
  });

  it("keeps two cashiers' open shifts apart", async () => {
    const other = await current(cashier2);
    await sell(cashier2, other.id, "cash");

    expect((await current(cashier2)).totalSales).toBe(10);
    // Смена первого кассира не видит чужую продажу, хотя обе открыты.
    expect((await current(cashier)).totalSales).toBe(40);
  });

  it("does not count a refunded cash sale against the drawer twice", async () => {
    const shift = await current(cashier2);
    const order = await sell(cashier2, shift.id, "cash");
    await refund(order.id);

    const live = await current(cashier2);
    // Наличные пришли и ушли обратно покупателю: в ящике — как до продажи.
    expect(live.totalCashSales).toBe(10);
    expect(live.totalRefunds).toBe(10);
    expect(live.expectedCash).toBe(100 + 10);
  });

  it("does not take a refunded card sale out of the drawer", async () => {
    const shift = await current(cashier2);
    const order = await sell(cashier2, shift.id, "card");
    await refund(order.id);

    // Карта ящика не касается ни при продаже, ни при возврате.
    expect((await current(cashier2)).expectedCash).toBe(100 + 10);
  });

  it("records the difference at close and keeps the totals", async () => {
    const shift = await current(cashier2);
    const closed = await api(`/cash-shifts/${shift.id}/close`, cashier2, { closingCash: shift.expectedCash - 5 });

    expect(closed.status).toBe(200);
    expect(closed.body.data).toMatchObject({
      status: "closed",
      closingCash: shift.expectedCash - 5,
      expectedCash: shift.expectedCash,
      difference: -5,
      totalCashSales: 10,
    });

    expect((await api(`/cash-shifts/${shift.id}/close`, cashier2, { closingCash: 0 })).status).toBe(404);
  });

  it("lets a cashier close only their own shift, and a manager close anyone's", async () => {
    const mine = await current(cashier);

    expect((await api(`/cash-shifts/${mine.id}/close`, cashier2, { closingCash: 0 })).status).toBe(403);

    const byManager = await api(`/cash-shifts/${mine.id}/close`, manager, { closingCash: mine.expectedCash });
    expect(byManager.status).toBe(200);
    expect(byManager.body.data.difference).toBe(0);
    expect(byManager.body.data.notes).toMatch(/закрыта администратором \(manager\)/);
  });
});
