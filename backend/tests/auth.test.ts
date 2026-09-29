import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestData, getTokens, cleanupTestData, adminToken, testTenantId, BASE_URL } from "./helpers.js";


describe("Auth API", () => {
  beforeAll(async () => {
    await setupTestData();
    await getTokens(BASE_URL);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("should login with valid credentials", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@test.com", password: "admin123" }),
    });
    const data = await res.json() as any;

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.user.email).toBe("admin@test.com");
    expect(data.data.accessToken).toBeDefined();
    expect(data.data.refreshToken).toBeDefined();
  });

  it("should reject invalid credentials", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@test.com", password: "wrongpassword" }),
    });
    const data = await res.json() as any;

    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it("should register new tenant", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "new@test.com",
        password: "password123",
        firstName: "New",
        lastName: "User",
        tenantName: "New Restaurant",
      }),
    });
    const data = await res.json() as any;

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.user.email).toBe("new@test.com");
  });

  it("should get current user", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json() as any;

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.email).toBe("admin@test.com");
  });

  it("should reject request without token", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`);
    const data = await res.json() as any;

    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it("should refresh token", async () => {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@test.com", password: "admin123" }),
    });
    const loginData = await loginRes.json() as any;

    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: loginData.data.refreshToken }),
    });
    const data = await res.json() as any;

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.accessToken).toBeDefined();
  });
});
