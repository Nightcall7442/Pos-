import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestData, getTokens, cleanupTestData, prisma, testTenantId, BASE_URL } from "./helpers.js";

// Порядок категорий в меню кассы. Точка видит и меняет только свои категории.

let admin: string;

const reorder = (ids: string[]) =>
  fetch(`${BASE_URL}/api/categories/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ ids }),
  });

describe("Categories", () => {
  beforeAll(async () => {
    await setupTestData();
    admin = (await getTokens(BASE_URL)).adminToken;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("reorders the shop's own categories", async () => {
    const a = await prisma.category.create({ data: { tenantId: testTenantId, name: "Напитки" } });
    const b = await prisma.category.create({ data: { tenantId: testTenantId, name: "Выпечка" } });

    expect((await reorder([b.id, a.id])).status).toBe(200);

    expect((await prisma.category.findUniqueOrThrow({ where: { id: b.id } })).sortOrder).toBe(0);
    expect((await prisma.category.findUniqueOrThrow({ where: { id: a.id } })).sortOrder).toBe(1);
  });

  it("cannot touch another shop's categories", async () => {
    const other = await prisma.tenant.create({ data: { name: "Чужая точка", slug: "other-categories" } });
    const foreign = await prisma.category.create({ data: { tenantId: other.id, name: "Чужая", sortOrder: 7 } });
    const mine = await prisma.category.create({ data: { tenantId: testTenantId, name: "Своя", sortOrder: 3 } });

    const res = await reorder([foreign.id, mine.id]);

    expect(res.status).toBe(404);
    expect((await prisma.category.findUniqueOrThrow({ where: { id: foreign.id } })).sortOrder).toBe(7);
    expect((await prisma.category.findUniqueOrThrow({ where: { id: mine.id } })).sortOrder).toBe(3);
  });
});
