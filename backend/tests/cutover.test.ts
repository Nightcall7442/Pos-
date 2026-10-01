import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient as PgClient } from "@prisma/client";
import { PrismaClient as SqliteClient } from "../prisma/generated/cutover-sqlite/index.js";
import { migrateSqliteToPostgres } from "../src/tools/sqlite-to-postgres.js";
import { resetTestDatabase, siblingTestDatabase } from "./testDatabase.js";

// Инструмент переноса прогоняется так же, как в день переезда: настоящий файл
// SQLite по замороженной схеме (prisma/cutover/sqlite.prisma), настоящий
// Postgres с накатанными миграциями. Данные — с подвохами, на которых перенос
// обычно и ломается: дерево категорий, время, записанное базой текстом,
// кириллица, дробные остатки, булевы поля, пустые значения.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET_URL = siblingTestDatabase("qwik_cutover_test");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qwik-cutover-"));

const CREATED = new Date("2025-03-04T05:06:07.089Z");
const UPDATED = new Date("2025-06-07T08:09:10.111Z");

function sqliteFile(name: string): string {
  const file = path.join(dir, name).split(path.sep).join("/");
  execSync("npx prisma db push --schema prisma/cutover/sqlite.prisma --skip-generate", {
    cwd: root,
    env: { ...process.env, SQLITE_URL: `file:${file}` },
    stdio: "pipe",
  });
  return file;
}

async function fill(file: string, opts: { duplicateOrderNumber?: boolean } = {}) {
  const db = new SqliteClient({ datasourceUrl: `file:${file}` });
  try {
    const tenant = await db.tenant.create({ data: { name: "Продукты «Барака»", slug: "baraka", createdAt: CREATED, updatedAt: UPDATED } });
    const user = await db.user.create({
      data: { tenantId: tenant.id, email: "a@b.uz", passwordHash: "x", firstName: "Азиза", lastName: "К.", isActive: false, lastLoginAt: null },
    });
    const parent = await db.category.create({ data: { tenantId: tenant.id, name: "Молочное", createdAt: CREATED, updatedAt: UPDATED } });
    await db.category.create({ data: { tenantId: tenant.id, name: "Кефир", parentId: parent.id, createdAt: CREATED, updatedAt: UPDATED } });
    const milk = await db.product.create({
      data: { tenantId: tenant.id, categoryId: parent.id, name: "Молоко «Лактис» 3,2%", price: 14500.5, currentStock: 84.236, barcode: "4780000000014", trackInventory: true },
    });
    const order = await db.order.create({
      data: { tenantId: tenant.id, userId: user.id, orderNumber: 7, status: "completed", subtotal: 14500.5, total: 14500.5, createdAt: CREATED },
    });
    await db.order.create({ data: { tenantId: tenant.id, orderNumber: opts.duplicateOrderNumber ? 7 : 8, status: "pending" } });
    await db.orderItem.create({ data: { orderId: order.id, productId: milk.id, quantity: 1, unitPrice: 14500.5, totalPrice: 14500.5 } });
    await db.payment.create({ data: { tenantId: tenant.id, orderId: order.id, method: "cash", amount: 14500.5, status: "completed" } });
    await db.inventoryMovement.create({ data: { tenantId: tenant.id, productId: milk.id, type: "out", quantity: 1.25, reason: "Продажа" } });
    await db.cashShift.create({ data: { tenantId: tenant.id, userId: user.id, status: "open" } });
    await db.catalogProduct.create({ data: { barcode: "5449000000996", name: "Coca-Cola 1,5 L", source: "snapshot" } });
    // Строка, которой время проставила сама база (DEFAULT CURRENT_TIMESTAMP) —
    // в SQLite это текст, а не число миллисекунд, как пишет Prisma.
    await db.$executeRawUnsafe(
      "INSERT INTO catalog_products (barcode, name, source, confirmations, updated_at) VALUES ('4600000000015', 'Кефир', 'shop', 2, CURRENT_TIMESTAMP)"
    );
    await db.catalogMeta.create({ data: { key: "snapshot_version", value: "abc" } });
    return { tenantId: tenant.id, parentId: parent.id };
  } finally {
    await db.$disconnect();
  }
}

async function freshTarget(): Promise<PgClient> {
  await resetTestDatabase(TARGET_URL);
  execSync("npx prisma migrate deploy", { cwd: root, env: { ...process.env, DATABASE_URL: TARGET_URL }, stdio: "pipe" });
  return new PgClient({ datasourceUrl: TARGET_URL });
}

const quiet = () => undefined;

describe("SQLite → Postgres cutover tool", () => {
  let target: PgClient;

  beforeAll(async () => {
    target = await freshTarget();
  });

  afterAll(async () => {
    await target?.$disconnect();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("refuses a database the new constraints would reject, and writes nothing", async () => {
    const file = sqliteFile("dupes.db");
    await fill(file, { duplicateOrderNumber: true });

    const report = await migrateSqliteToPostgres({ sqlitePath: file, target, log: quiet });

    expect(report.ok).toBe(false);
    expect(report.problems.join("\n")).toMatch(/номер заказа 7 повторяется/);
    expect(await target.tenant.count()).toBe(0);
  });

  it("dry run reads everything, writes nothing and leaves no snapshot behind", async () => {
    const file = sqliteFile("dry.db");
    await fill(file);

    const report = await migrateSqliteToPostgres({ sqlitePath: file, target, dryRun: true, log: quiet });

    expect(report.ok).toBe(true);
    expect(report.tables.find((t) => t.model === "Product")?.source).toBe(1);
    expect(await target.tenant.count()).toBe(0);
    expect(fs.existsSync(`${file}.dry-run.db`)).toBe(false);
  });

  it("copies every table exactly and keeps the original file untouched", async () => {
    const file = sqliteFile("prod.db");
    const { tenantId, parentId } = await fill(file);
    const before = fs.readFileSync(file);

    const report = await migrateSqliteToPostgres({ sqlitePath: file, target, log: quiet });

    expect(report.problems).toEqual([]);
    expect(report.ok).toBe(true);
    for (const t of report.tables) expect(t.digestMatches, t.model).toBe(true);
    expect(fs.readFileSync(file).equals(before)).toBe(true);
    expect(fs.existsSync(`${file}.pre-postgres.db`)).toBe(true);

    // Время строк — как было, а не «сейчас».
    const tenant = await target.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    expect(tenant.createdAt.toISOString()).toBe(CREATED.toISOString());
    expect(tenant.updatedAt.toISOString()).toBe(UPDATED.toISOString());

    // Ссылка на родителя восстановлена вторым проходом и не сдвинула updatedAt.
    const child = await target.category.findFirstOrThrow({ where: { name: "Кефир" } });
    expect(child.parentId).toBe(parentId);
    expect(child.updatedAt.toISOString()).toBe(UPDATED.toISOString());

    // Дробные и булевы значения, кириллица.
    const milk = await target.product.findFirstOrThrow({ where: { tenantId } });
    expect(milk.currentStock).toBe(84.236);
    expect(milk.name).toBe("Молоко «Лактис» 3,2%");
    expect((await target.user.findFirstOrThrow({ where: { tenantId } })).isActive).toBe(false);

    // Время, которое SQLite хранил текстом, прочитано как время.
    const kefir = await target.catalogProduct.findUniqueOrThrow({ where: { barcode: "4600000000015" } });
    expect(kefir.updatedAt).toBeInstanceOf(Date);
    expect(Number.isNaN(kefir.updatedAt.getTime())).toBe(false);

    // Счётчик номеров продолжает с максимума: следующий заказ точки — №9.
    const counter = await target.orderCounter.findUniqueOrThrow({ where: { tenantId } });
    expect(counter.lastNumber).toBe(8);
  });

  it("refuses to copy into a database that already has data", async () => {
    const file = sqliteFile("again.db");
    await fill(file);

    const report = await migrateSqliteToPostgres({ sqlitePath: file, target, log: quiet });

    expect(report.ok).toBe(false);
    expect(report.problems.join("\n")).toMatch(/уже \d+ строк/);
  });
});
