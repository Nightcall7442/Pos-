import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestData, getTokens, cleanupTestData, prisma, testTenantId, BASE_URL } from "./helpers.js";

let adminToken: string;
let orderId: string;

describe("Payments API", () => {
  beforeAll(async () => {
    await setupTestData();
    const tokens = await getTokens(BASE_URL);
    adminToken = tokens.adminToken;

    // Create an order to pay for
    const product = await prisma.product.findFirst({
      where: { tenantId: testTenantId },
    });
    const table = await prisma.table.findFirst({
      where: { tenantId: testTenantId },
    });

    const orderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        type: "dine_in",
        tableId: table?.id,
        items: [{ productId: product?.id, quantity: 1, unitPrice: 12.99 }],
      }),
    });
    const orderData = await orderRes.json() as any;
    orderId = orderData.data.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("should create a payment", async () => {
    const order = await prisma.order.findFirst({
      where: { id: orderId },
    });

    const res = await fetch(`${BASE_URL}/api/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        orderId,
        method: "cash",
        amount: order?.total || 14.29,
      }),
    });
    const data = await res.json() as any;

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.method).toBe("cash");
    expect(data.data.status).toBe("completed");
  });

  it("should list payments", async () => {
    const res = await fetch(`${BASE_URL}/api/payments`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json() as any;

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
  });

  it("should get payment summary", async () => {
    const res = await fetch(`${BASE_URL}/api/payments/summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json() as any;

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.totalRevenue).toBeGreaterThan(0);
  });

  it("should reject payment exceeding order total", async () => {
    // A fresh, unpaid order: paying an already completed one is refused for a
    // different reason (409), which would not exercise the amount check.
    const product = await prisma.product.findFirst({ where: { tenantId: testTenantId } });
    const orderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ type: "takeaway", items: [{ productId: product?.id, quantity: 1 }] }),
    });
    const fresh = (await orderRes.json()) as any;

    const res = await fetch(`${BASE_URL}/api/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        orderId: fresh.data.id,
        method: "cash",
        amount: 99999,
      }),
    });
    const data = await res.json() as any;

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("should reject a partial payment unless explicitly allowed", async () => {
    const product = await prisma.product.findFirst({ where: { tenantId: testTenantId } });
    const orderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ type: "takeaway", items: [{ productId: product?.id, quantity: 1 }] }),
    });
    const fresh = (await orderRes.json()) as any;

    const res = await fetch(`${BASE_URL}/api/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ orderId: fresh.data.id, method: "cash", amount: 0.5 }),
    });
    expect(res.status).toBe(400);

    const stillPending = await prisma.order.findUnique({ where: { id: fresh.data.id } });
    expect(stillPending?.status).toBe("pending");
  });

  it("should refund a payment", async () => {
    const payment = await prisma.payment.findFirst({
      where: { orderId, status: "completed" },
    });
    if (!payment) return;

    const res = await fetch(`${BASE_URL}/api/payments/${payment.id}/refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ reason: "Customer not satisfied" }),
    });
    const data = await res.json() as any;

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.status).toBe("refunded");
  });
});
