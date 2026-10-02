import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { setupTestData, getTokens, cleanupTestData, prisma, testTenantId, testUserId, BASE_URL } from "./helpers.js";

// Сотрудники и роли. README: «назначить роль admin может только
// администратор». Это правило и всё, что вокруг него, до сих пор не
// проверял ни один тест.

let admin: string;
let cashier: string;
let manager: string;
let managerId: string;
let n = 0;

const call = async (method: string, path: string, token: string, body?: unknown) => {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
};

const login = async (email: string, password: string) =>
  fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

const person = (role: string, extra: Record<string, unknown> = {}) => {
  n += 1;
  return { email: `staff${n}@test.com`, password: "password123", firstName: "Сотрудник", lastName: String(n), role, ...extra };
};

describe("Users and roles", () => {
  beforeAll(async () => {
    await setupTestData();
    const tokens = await getTokens(BASE_URL);
    admin = tokens.adminToken;
    cashier = tokens.cashierToken;
    const m = await prisma.user.create({
      data: { tenantId: testTenantId, email: "manager@test.com", passwordHash: await bcrypt.hash("password123", 10), firstName: "Менеджер", lastName: "M", role: "manager" },
    });
    managerId = m.id;
    manager = ((await (await login("manager@test.com", "password123")).json()) as any).data.accessToken;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("keeps the users screen away from cashiers", async () => {
    expect((await call("GET", "/users", cashier)).status).toBe(403);
    expect((await call("POST", "/users", cashier, person("cashier"))).status).toBe(403);
  });

  it("lets a manager hire a cashier, but not an admin", async () => {
    expect((await call("POST", "/users", manager, person("cashier"))).status).toBe(201);

    const res = await call("POST", "/users", manager, person("admin"));
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Только администратор может назначить роль admin/);
  });

  it("lets an admin hire an admin", async () => {
    expect((await call("POST", "/users", admin, person("admin"))).status).toBe(201);
  });

  it("does not let a manager promote anyone to admin, themselves included", async () => {
    const hired = (await call("POST", "/users", manager, person("cashier"))).body.data;
    expect((await call("PUT", `/users/${hired.id}`, manager, { role: "admin" })).status).toBe(403);
    expect((await call("PUT", `/users/${managerId}`, manager, { role: "admin" })).status).toBe(403);
  });

  // Без этого менеджер мог сменить администратору пароль или почту — и войти
  // под ним: ограничение «только администратор назначает admin» обходилось.
  it("does not let a manager change an admin's password, email or PIN", async () => {
    for (const patch of [{ password: "takeover123" }, { email: "mine@test.com" }, { pin: "1111" }, { firstName: "Взлом" }]) {
      const res = await call("PUT", `/users/${testUserId}`, manager, patch);
      expect(res.status, JSON.stringify(patch)).toBe(403);
    }
    expect((await login("admin@test.com", "admin123")).status).toBe(200);
  });

  it("does not let a manager switch an admin off", async () => {
    expect((await call("POST", `/users/${testUserId}/toggle`, manager)).status).toBe(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: testUserId } })).isActive).toBe(true);
  });

  it("does not let anyone switch themselves off", async () => {
    expect((await call("POST", `/users/${testUserId}/toggle`, admin)).status).toBe(400);
    expect((await call("POST", `/users/${managerId}/toggle`, manager)).status).toBe(400);
  });

  it("never sends password or PIN hashes back", async () => {
    const hired = (await call("POST", "/users", admin, person("cashier", { pin: "4321" }))).body.data;

    const responses = [
      await call("GET", "/users?limit=100", admin),
      await call("GET", `/users/${hired.id}`, admin),
      await call("PUT", `/users/${hired.id}`, admin, { firstName: "Новое имя" }),
      await call("POST", `/users/${hired.id}/toggle`, admin),
    ];
    for (const r of responses) {
      expect(r.status).toBe(200);
      const text = JSON.stringify(r.body);
      expect(text).not.toMatch(/passwordHash|"pin"/);
      expect(text).not.toMatch(/\$2[aby]\$/); // bcrypt-хеш в любом поле
    }
    expect(responses[1].body.data.hasPin).toBe(true);
  });

  it("locks a switched-off employee out", async () => {
    const p = person("cashier");
    const hired = (await call("POST", "/users", admin, p)).body.data;
    expect((await login(p.email, p.password)).status).toBe(200);

    await call("POST", `/users/${hired.id}/toggle`, admin);

    expect((await login(p.email, p.password)).status).toBe(401);
  });

  it("refuses a second employee with the same email", async () => {
    const p = person("cashier");
    expect((await call("POST", "/users", admin, p)).status).toBe(201);
    expect((await call("POST", "/users", admin, p)).status).toBe(409);
  });

  it("does not see employees of another shop", async () => {
    const other = await prisma.tenant.create({ data: { name: "Чужая точка", slug: "other-shop" } });
    const stranger = await prisma.user.create({
      data: { tenantId: other.id, email: "stranger@test.com", passwordHash: "x", firstName: "Чужой", lastName: "S", role: "cashier" },
    });

    expect((await call("GET", `/users/${stranger.id}`, admin)).status).toBe(404);
    expect((await call("PUT", `/users/${stranger.id}`, admin, { firstName: "Мой" })).status).toBe(404);
    expect((await call("POST", `/users/${stranger.id}/toggle`, admin)).status).toBe(404);
  });
});
