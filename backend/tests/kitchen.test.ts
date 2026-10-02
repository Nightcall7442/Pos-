import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestData, getTokens, cleanupTestData, prisma, testTenantId, BASE_URL } from "./helpers.js";

// Касса кафе продаёт одним запросом: заказ сразу оплачен (status "completed" —
// на нём держатся выручка, смена и склад). Кухня раньше смотрела на тот же
// status и такие заказы не видела никогда. Теперь у заказа свой kitchenStatus:
// оплаченный заказ кафе встаёт на экран кухни сразу, а деньги не ждут повара.

let adminToken: string;
let cashierToken: string;

const api = (path: string, token: string, init: RequestInit = {}) =>
  fetch(`${BASE_URL}/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });

async function sell(token: string, price = 25000) {
  const dish = await prisma.product.create({ data: { tenantId: testTenantId, name: `Плов ${Math.random()}`, price, trackInventory: false } });
  const res = await api("/orders/checkout", token, {
    method: "POST",
    body: JSON.stringify({ type: "dine_in", items: [{ productId: dish.id, quantity: 2 }], expectedTotal: price * 2, payment: { method: "cash" } }),
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as any).data;
}

const kitchenBoard = async () => ((await (await api("/orders/kitchen", adminToken)).json()) as any).data as any[];
const step = (id: string, status: string, token = adminToken) =>
  api(`/orders/${id}/kitchen`, token, { method: "PATCH", body: JSON.stringify({ status }) });

describe("Kitchen: paid café orders reach the kitchen", () => {
  beforeAll(async () => {
    await setupTestData();
    const tokens = await getTokens(BASE_URL);
    adminToken = tokens.adminToken;
    cashierToken = tokens.cashierToken;
    await prisma.tenant.update({ where: { id: testTenantId }, data: { businessType: "cafe" } });
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("puts a paid café sale on the kitchen board while the sale stays completed", async () => {
    const order = await sell(cashierToken);
    expect(order.status).toBe("completed");
    expect(order.kitchenStatus).toBe("new");

    const board = await kitchenBoard();
    expect(board.map((o) => o.id)).toContain(order.id);
  });

  it("walks the order through cooking and ready, and takes it off the board when served", async () => {
    const order = await sell(cashierToken);
    for (const status of ["cooking", "ready"]) {
      const res = await step(order.id, status);
      expect(res.status).toBe(200);
      expect(((await res.json()) as any).data.kitchenStatus).toBe(status);
    }
    expect((await kitchenBoard()).find((o) => o.id === order.id)?.kitchenStatus).toBe("ready");

    expect((await step(order.id, "served")).status).toBe(200);
    expect((await kitchenBoard()).map((o) => o.id)).not.toContain(order.id);

    // Деньги кухня не трогает: продажа как была оплаченной, так и осталась.
    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe("completed");
  });

  it("lets the cook undo a mis-tap: served back to ready", async () => {
    const order = await sell(cashierToken);
    await step(order.id, "served");
    expect((await step(order.id, "ready")).status).toBe(200);
    expect((await kitchenBoard()).map((o) => o.id)).toContain(order.id);
  });

  it("keeps the cashier out of the kitchen steps", async () => {
    const order = await sell(cashierToken);
    expect((await step(order.id, "cooking", cashierToken)).status).toBe(403);
    expect((await api("/orders/kitchen", cashierToken)).status).toBe(403);
  });

  it("rejects an unknown step", async () => {
    const order = await sell(cashierToken);
    expect((await step(order.id, "eaten")).status).toBe(400);
  });

  it("does not send a shop's sale to the kitchen", async () => {
    await prisma.tenant.update({ where: { id: testTenantId }, data: { businessType: "retail" } });
    try {
      const order = await sell(cashierToken);
      expect(order.kitchenStatus).toBeNull();
      expect((await kitchenBoard()).map((o) => o.id)).not.toContain(order.id);
      expect((await step(order.id, "cooking")).status).toBe(409);
    } finally {
      await prisma.tenant.update({ where: { id: testTenantId }, data: { businessType: "cafe" } });
    }
  });

  it("takes a cancelled order off the board", async () => {
    const dish = await prisma.product.create({ data: { tenantId: testTenantId, name: "Лагман", price: 30000, trackInventory: false } });
    const created = await api("/orders", adminToken, {
      method: "POST",
      body: JSON.stringify({ type: "takeaway", items: [{ productId: dish.id, quantity: 1 }] }),
    });
    const order = ((await created.json()) as any).data;
    expect((await kitchenBoard()).map((o) => o.id)).toContain(order.id);

    expect((await api(`/orders/${order.id}/cancel`, adminToken, { method: "POST" })).status).toBe(200);
    expect((await kitchenBoard()).map((o) => o.id)).not.toContain(order.id);
  });
});
