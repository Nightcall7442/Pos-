import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestData, getTokens, cleanupTestData, prisma, testTenantId, BASE_URL } from "./helpers.js";

let adminToken: string;
let orderId: string;

describe("Orders API", () => {
  beforeAll(async () => {
    await setupTestData();
    const tokens = await getTokens(BASE_URL);
    adminToken = tokens.adminToken;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("should create an order", async () => {
    const product = await prisma.product.findFirst({
      where: { tenantId: testTenantId },
    });
    const table = await prisma.table.findFirst({
      where: { tenantId: testTenantId },
    });

    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        type: "dine_in",
        tableId: table?.id,
        items: [
          {
            productId: product?.id,
            quantity: 2,
            unitPrice: 12.99,
          },
        ],
      }),
    });
    const data = await res.json() as any;

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.items).toHaveLength(1);
    expect(data.data.subtotal).toBe(25.98);
    expect(data.data.total).toBeGreaterThan(0);
    orderId = data.data.id;
  });

  it("should list orders", async () => {
    const res = await fetch(`${BASE_URL}/api/orders`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json() as any;

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
  });

  it("should get order by id", async () => {
    const res = await fetch(`${BASE_URL}/api/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json() as any;

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe(orderId);
  });

  it("should update order status", async () => {
    const res = await fetch(`${BASE_URL}/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: "confirmed" }),
    });
    const data = await res.json() as any;

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.status).toBe("confirmed");
  });

  it("should cancel order", async () => {
    const product = await prisma.product.findFirst({
      where: { tenantId: testTenantId },
    });

    const createRes = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        type: "takeaway",
        items: [{ productId: product?.id, quantity: 1, unitPrice: 12.99 }],
      }),
    });
    const createData = await createRes.json() as any;

    const res = await fetch(`${BASE_URL}/api/orders/${createData.data.id}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json() as any;

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.status).toBe("cancelled");
  });

  it("should get active orders", async () => {
    const res = await fetch(`${BASE_URL}/api/orders/active`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json() as any;

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  it("should reject order without items", async () => {
    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ type: "dine_in", items: [] }),
    });

    expect(res.status).toBe(400);
  });
});
