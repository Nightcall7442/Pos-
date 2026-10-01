import { describe, it, expect, beforeAll, afterAll } from "vitest";
import jwt from "jsonwebtoken";
import { setupTestData, getTokens, cleanupTestData, adminToken, testTenantId, testUserId, BASE_URL } from "./helpers.js";


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

  // До появления поля typ токен доступа и токен обновления отличались только
  // секретом подписи: с одинаковыми секретами одно работало вместо другого, и
  // 15 минут доступа превращались в 7 дней. Совпадение секретов теперь
  // запрещает config/env.ts, а эти два теста проверяют вторую линию — что
  // сервер смотрит на заявленный в токене тип. Токены здесь подписываются
  // тестовыми секретами из vitest.config.ts намеренно «не тем» типом: иначе
  // запрос отклонила бы проверка подписи, а не проверка типа.
  const JWT_SECRET = process.env.JWT_SECRET as string;
  const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;

  function sign(secret: string, claims: Record<string, unknown>): string {
    return jwt.sign(
      { id: testUserId, tenantId: testTenantId, email: "admin@test.com", role: "admin", firstName: "Admin", lastName: "Test", ...claims },
      secret,
      { expiresIn: "15m" }
    );
  }

  it("should reject a token that is not marked as an access token", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${sign(JWT_SECRET, { typ: "refresh", ver: 0 })}` },
    });

    expect(res.status).toBe(401);
  });

  it("should reject a token that is not marked as a refresh token", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: sign(JWT_REFRESH_SECRET, { typ: "access" }) }),
    });

    expect(res.status).toBe(401);
  });

  // Смена пароля должна завершать сессии, а не только менять строку в базе.
  // Своя точка и свой пользователь — чтобы не менять пароль админа, которым
  // входят остальные тесты файла.
  it("should invalidate refresh tokens issued before a password change", async () => {
    const stamp = Date.now();
    const email = `pwd-${stamp}@test.com`;

    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "oldpassword1",
        firstName: "Pwd",
        lastName: "Owner",
        tenantName: `Pwd Shop ${stamp}`,
      }),
    });
    const regData = await regRes.json() as any;
    expect(regRes.status).toBe(201);
    const { accessToken, refreshToken } = regData.data;

    const changed = await fetch(`${BASE_URL}/api/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ currentPassword: "oldpassword1", newPassword: "newpassword1" }),
    });
    expect(changed.status).toBe(200);

    const stale = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    expect(stale.status).toBe(401);

    // А новый вход выдаёт рабочую пару.
    const reloginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "newpassword1" }),
    });
    const reloginData = await reloginRes.json() as any;
    expect(reloginRes.status).toBe(200);

    const fresh = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: reloginData.data.refreshToken }),
    });
    expect(fresh.status).toBe(200);
  });
});
