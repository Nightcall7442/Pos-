import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestData, getTokens, cleanupTestData, prisma, testTenantId, testUserId, BASE_URL } from "./helpers.js";
import { todayInZone, zonedDayStart } from "../src/utils/dates.js";

// README обещает: отчёты считают в часовом поясе заведения, а даты — это
// календарные дни заведения, а не UTC. Для Ташкента (UTC+5) это пять часов
// разницы: продажа в 01:30 по местному времени 1 октября — это 20:30 UTC
// 30 сентября, и в отчёт «за 30 сентября по UTC» она попала бы не туда.

const TZ = "Asia/Tashkent";
let admin: string;
let cashierId: string;
let productId: string;
let number = 1000;

const get = async (path: string) => {
  const res = await fetch(`${BASE_URL}/api${path}`, { headers: { Authorization: `Bearer ${admin}` } });
  return { status: res.status, body: (await res.json()) as any };
};

// Заказ с оплатой в заданный момент (UTC). Время ставится явно — через API
// продажа всегда «сейчас».
async function sale(at: string, total: number, opts: { userId?: string; status?: string } = {}) {
  number += 1;
  const createdAt = new Date(at);
  const order = await prisma.order.create({
    data: {
      tenantId: testTenantId,
      userId: opts.userId ?? testUserId,
      orderNumber: number,
      type: "takeaway",
      status: opts.status ?? "completed",
      subtotal: total,
      total,
      createdAt,
      items: { create: [{ productId, quantity: 1, unitPrice: total, totalPrice: total }] },
    },
  });
  if ((opts.status ?? "completed") === "completed") {
    await prisma.payment.create({
      data: { tenantId: testTenantId, orderId: order.id, method: "cash", amount: total, status: "completed", createdAt },
    });
  }
  return order;
}

describe("Reports in the shop's time zone", () => {
  beforeAll(async () => {
    await setupTestData();
    const tokens = await getTokens(BASE_URL);
    admin = tokens.adminToken;
    await prisma.tenant.update({ where: { id: testTenantId }, data: { timezone: TZ } });
    cashierId = (await prisma.user.findFirstOrThrow({ where: { email: "cashier@test.com" } })).id;
    productId = (await prisma.product.findFirstOrThrow({ where: { tenantId: testTenantId } })).id;

    await sale("2026-09-30T18:00:00Z", 7); //  23:00, 30 сентября по Ташкенту
    await sale("2026-09-30T20:30:00Z", 100, { userId: cashierId }); // 01:30, 1 октября
    await sale("2026-10-01T18:50:00Z", 50); //  23:50, 1 октября
    await sale("2026-10-01T10:00:00Z", 999, { status: "cancelled" }); // отменённый — не в счёт
    await sale("2026-10-01T19:10:00Z", 30); //  00:10, 2 октября
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("counts a calendar day of the shop, not of UTC", async () => {
    const res = await get("/reports/sales?dateFrom=2026-10-01&dateTo=2026-10-01");

    expect(res.status).toBe(200);
    // По UTC 1 октября — это 50 + 30 = 80; по Ташкенту — 100 + 50.
    expect(res.body.data.totalRevenue).toBe(150);
    expect(res.body.data.totalTransactions).toBe(2);
  });

  it("puts sales into the shop's local hours", async () => {
    const res = await get("/reports/sales?dateFrom=2026-10-01&dateTo=2026-10-01");
    expect(res.body.data.salesByHour).toEqual([
      { hour: "01", order_count: 1, revenue: 100 },
      { hour: "23", order_count: 1, revenue: 50 },
    ]);
  });

  it("includes both ends of a range of days", async () => {
    const res = await get("/reports/sales?dateFrom=2026-09-30&dateTo=2026-10-02");
    expect(res.body.data.totalRevenue).toBe(7 + 100 + 50 + 30);
  });

  it("splits sales by employee for the day, without cancelled orders", async () => {
    const res = await get("/reports/employees?dateFrom=2026-10-01&dateTo=2026-10-01");
    expect(res.status).toBe(200);
    const byId = new Map((res.body.data as any[]).map((e) => [e.id, e]));
    expect(byId.get(cashierId)).toMatchObject({ ordersCount: 1, totalSales: 100 });
    expect(byId.get(testUserId)).toMatchObject({ ordersCount: 1, totalSales: 50 });
  });

  it("rejects a range that ends before it starts", async () => {
    const res = await get("/reports/sales?dateFrom=2026-10-02&dateTo=2026-10-01");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/раньше даты начала/);
  });

  it("dashboard: today is today in the shop's zone", async () => {
    const todayStart = zonedDayStart(todayInZone(TZ), TZ);
    const before = (await get("/reports/dashboard")).body.data.todayRevenue;

    await sale(new Date(todayStart.getTime() + 60_000).toISOString(), 40); // минута после местной полуночи
    await sale(new Date(todayStart.getTime() - 60_000).toISOString(), 1000); // минута до неё — это вчера

    expect((await get("/reports/dashboard")).body.data.todayRevenue).toBe(before + 40);
  });

  it("dashboard: «мало на складе» counts only products at or below their minimum", async () => {
    const category = await prisma.category.findFirstOrThrow({ where: { tenantId: testTenantId } });
    const make = (sku: string, currentStock: number, minStock: number) =>
      prisma.product.create({
        data: { tenantId: testTenantId, categoryId: category.id, name: sku, sku, price: 1, currentStock, minStock, trackInventory: true },
      });
    await make("LOW-1", 1, 5);
    await make("LOW-EDGE", 5, 5);
    await make("FULL", 50, 5);

    const tracked = await prisma.product.findMany({ where: { tenantId: testTenantId, trackInventory: true, isActive: true } });
    const expected = tracked.filter((p) => p.currentStock <= p.minStock).length;

    expect((await get("/reports/dashboard")).body.data.lowStockProducts).toBe(expected);
  });
});
