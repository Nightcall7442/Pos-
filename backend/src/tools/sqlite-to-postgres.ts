/**
 * Перенос данных из старой базы SQLite в PostgreSQL — один раз, при переезде.
 *
 *   node dist/tools/sqlite-to-postgres.js --sqlite /data/qwik.db [--dry-run] [--truncate]
 *   (из исходников: npx tsx src/tools/sqlite-to-postgres.ts …)
 *
 * Куда писать — DATABASE_URL (Postgres, схема уже накатана `prisma migrate deploy`).
 * Порядок работы и откат — RAILWAY.md, раздел «Переезд с SQLite на Postgres».
 *
 * Что делает:
 *  1. Снимок. Prisma открывает SQLite только на запись — режим ?mode=ro он
 *     молча игнорирует, — поэтому исходный файл не читается напрямую: сначала
 *     VACUUM INTO делает согласованную копию рядом с ним, и всё дальнейшее идёт
 *     по копии. Исходный файл остаётся как был — это и есть путь отката.
 *  2. Проверки снимка: целостность, «висячие» внешние ключи, данные, которые
 *     новые ограничения Postgres не примут (повторы номеров заказов, две
 *     открытые смены у одного кассира, символ NUL в тексте).
 *  3. Проверки цели: таблицы пусты (или --truncate), часовой пояс UTC,
 *     локаль складывает кириллицу.
 *  4. Копирование всех моделей в порядке внешних ключей, пачками. id,
 *     createdAt и updatedAt сохраняются как были. Ссылки категории на
 *     родителя ставятся вторым проходом.
 *  5. Счётчики номеров заказов — от максимума номеров каждой точки.
 *  6. Сверка: число строк и SHA-256 по всем строкам каждой таблицы, прочитанным
 *     с обеих сторон одинаково. Хоть одно расхождение — код выхода 1.
 *
 * --dry-run: шаги 1–3 и полное чтение снимка (строку, которую Prisma не может
 * прочитать, лучше найти за день до переезда, а не во время него).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient as PgClient, Prisma as PgPrisma } from "@prisma/client";
import { PrismaClient as SqliteClient, Prisma as SqlitePrisma } from "../../prisma/generated/cutover-sqlite/index.js";

type Row = Record<string, unknown>;
type Delegate = {
  findMany(args: unknown): Promise<Row[]>;
  count(): Promise<number>;
  createMany(args: { data: Row[] }): Promise<{ count: number }>;
};

interface ModelPlan {
  name: string;
  table: string;
  delegate: string;
  scalars: string[];
  primaryKey: string[];
  pkColumns: string[];
  // Поля-ссылки на ту же модель (родитель категории): при вставке — null,
  // настоящие значения ставятся после того, как все строки уже есть.
  selfRefs: { field: string; column: string }[];
}

// Порядок вставки: каждая модель ссылается только на модели выше по списку.
// Проверяется при старте по связям из схемы.
export const COPY_ORDER = [
  "Tenant",
  "User",
  "Branch",
  "Category",
  "TechCard",
  "Product",
  "ModifierGroup",
  "ModifierItem",
  "ProductModifierGroup",
  "Table",
  "CashShift",
  "Order",
  "OrderItem",
  "OrderItemModifier",
  "Payment",
  "Receipt",
  "InventoryMovement",
  "StockReceipt",
  "StockReceiptItem",
  "Reservation",
  "AuditLog",
  "Notification",
  "CatalogProduct",
  "CatalogMeta",
];

export interface MigrateOptions {
  sqlitePath: string;
  snapshotPath?: string;
  dryRun?: boolean;
  truncate?: boolean;
  batchSize?: number;
  log?: (message: string) => void;
  /** Postgres-клиент; по умолчанию — из DATABASE_URL. */
  target?: PgClient;
}

export interface TableReport {
  model: string;
  source: number;
  target: number | null;
  digestMatches: boolean | null;
}

export interface MigrateReport {
  snapshotPath: string;
  snapshotSha1: string;
  problems: string[];
  tables: TableReport[];
  ok: boolean;
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function buildPlans(): ModelPlan[] {
  const models = SqlitePrisma.dmmf.datamodel.models;
  const byName = new Map(models.map((m) => [m.name, m]));

  const missing = models.map((m) => m.name).filter((n) => !COPY_ORDER.includes(n));
  if (missing.length) throw new Error(`В COPY_ORDER нет моделей: ${missing.join(", ")}`);

  const position = new Map(COPY_ORDER.map((n, i) => [n, i]));
  return COPY_ORDER.map((name) => {
    const model = byName.get(name);
    if (!model) throw new Error(`Модели ${name} нет в замороженной схеме SQLite`);

    const column = (fieldName: string) => {
      const field = model.fields.find((f) => f.name === fieldName)!;
      return field.dbName ?? field.name;
    };

    const selfRefs: ModelPlan["selfRefs"] = [];
    for (const field of model.fields) {
      if (field.kind !== "object" || !field.relationFromFields?.length) continue;
      if (field.type === name) {
        for (const fk of field.relationFromFields) selfRefs.push({ field: fk, column: column(fk) });
        continue;
      }
      // Ссылка на модель, которая вставляется позже, сломала бы внешний ключ.
      if ((position.get(field.type) ?? -1) > position.get(name)!) {
        throw new Error(`COPY_ORDER: ${name} ссылается на ${field.type}, но идёт раньше`);
      }
    }

    const primaryKey = [...(model.primaryKey?.fields ?? model.fields.filter((f) => f.isId).map((f) => f.name))];
    return {
      name,
      table: model.dbName ?? model.name,
      delegate: lowerFirst(name),
      scalars: model.fields.filter((f) => f.kind === "scalar" || f.kind === "enum").map((f) => f.name),
      primaryKey,
      pkColumns: primaryKey.map(column),
      selfRefs,
    };
  });
}

// Строка в одну форму для контрольной суммы: поля в порядке схемы, время —
// ISO-строкой. Обе стороны читаются через Prisma, поэтому число с плавающей
// точкой, булево и null приходят одинаковыми JS-значениями.
function canonical(row: Row, scalars: string[]): string {
  return JSON.stringify(scalars.map((f) => (row[f] instanceof Date ? (row[f] as Date).toISOString() : (row[f] ?? null))));
}

async function* readAll(delegate: Delegate, plan: ModelPlan, requested: number): AsyncGenerator<Row[]> {
  // В Postgres не больше 65 535 параметров на запрос, а createMany передаёт по
  // параметру на каждое поле каждой строки: у товара их под сорок.
  const batchSize = Math.max(1, Math.min(requested, Math.floor(60000 / plan.scalars.length)));
  const orderBy = plan.primaryKey.map((f) => ({ [f]: "asc" }));
  for (let skip = 0; ; skip += batchSize) {
    const rows = await delegate.findMany({ orderBy, skip, take: batchSize });
    if (rows.length === 0) return;
    yield rows;
    if (rows.length < batchSize) return;
  }
}

async function digest(delegate: Delegate, plan: ModelPlan, batchSize: number): Promise<{ count: number; hash: string }> {
  const hash = crypto.createHash("sha256");
  let count = 0;
  for await (const rows of readAll(delegate, plan, batchSize)) {
    for (const row of rows) hash.update(canonical(row, plan.scalars) + "\n");
    count += rows.length;
  }
  return { count, hash: hash.digest("hex") };
}

async function preflight(source: SqliteClient, plans: ModelPlan[]): Promise<string[]> {
  const problems: string[] = [];

  const integrity = await source.$queryRawUnsafe<{ integrity_check: string }[]>("PRAGMA integrity_check");
  if (integrity[0]?.integrity_check !== "ok") {
    problems.push(`PRAGMA integrity_check: ${integrity.map((r) => r.integrity_check).join("; ")}`);
  }

  const orphans = await source.$queryRawUnsafe<{ table: string; parent: string }[]>("PRAGMA foreign_key_check");
  if (orphans.length) {
    const byTable = new Map<string, number>();
    for (const o of orphans) byTable.set(`${o.table} → ${o.parent}`, (byTable.get(`${o.table} → ${o.parent}`) ?? 0) + 1);
    for (const [k, n] of byTable) problems.push(`висячие внешние ключи ${k}: ${n} строк`);
  }

  const dupNumbers = await source.$queryRawUnsafe<{ tenant_id: string; order_number: number; n: number }[]>(
    "SELECT tenant_id, order_number, count(*) AS n FROM orders GROUP BY tenant_id, order_number HAVING count(*) > 1"
  );
  for (const d of dupNumbers) {
    problems.push(`номер заказа ${d.order_number} повторяется ${Number(d.n)} раз в точке ${d.tenant_id} — в Postgres он уникален`);
  }

  const openShifts = await source.$queryRawUnsafe<{ tenant_id: string; user_id: string; n: number }[]>(
    "SELECT tenant_id, user_id, count(*) AS n FROM cash_shifts WHERE status = 'open' GROUP BY tenant_id, user_id HAVING count(*) > 1"
  );
  for (const s of openShifts) {
    problems.push(`у кассира ${s.user_id} (точка ${s.tenant_id}) ${Number(s.n)} открытых смены — в Postgres допускается одна; закройте лишние`);
  }

  // Postgres не хранит символ NUL в тексте, и вставка такой строки оборвала бы перенос.
  const models = new Map(SqlitePrisma.dmmf.datamodel.models.map((m) => [m.name, m]));
  for (const plan of plans) {
    const model = models.get(plan.name)!;
    for (const field of model.fields.filter((f) => f.kind === "scalar" && f.type === "String")) {
      const col = field.dbName ?? field.name;
      const [row] = await source.$queryRawUnsafe<{ n: number }[]>(
        `SELECT count(*) AS n FROM "${plan.table}" WHERE instr("${col}", char(0)) > 0`
      );
      if (Number(row?.n) > 0) problems.push(`${plan.table}.${col}: ${Number(row.n)} строк с символом NUL`);
    }
  }

  return problems;
}

async function checkTarget(target: PgClient, plans: ModelPlan[], truncate: boolean, log: (m: string) => void): Promise<string[]> {
  const problems: string[] = [];
  const [env] = await target.$queryRaw<{ tz: string; folds: boolean }[]>`
    SELECT current_setting('TimeZone') AS tz, lower('МОЛОКО') = 'молоко' AND 'Молоко' ILIKE 'молоко' AS folds`;
  if (!["UTC", "Etc/UTC"].includes(env.tz)) {
    problems.push(`TimeZone сессии Postgres — ${env.tz}, нужен UTC: добавьте options=-c%20TimeZone%3DUTC в DATABASE_URL`);
  }
  if (!env.folds) problems.push("локаль Postgres не складывает кириллицу (LC_CTYPE=C?) — поиск товаров будет промахиваться");

  // Все таблицы Postgres, а не только перенесённые: и те, которых в SQLite не
  // было (счётчики номеров, ключи идемпотентности), должны быть пусты.
  const tables = PgPrisma.dmmf.datamodel.models.map((m) => m.dbName ?? m.name);
  if (truncate) {
    log("Очищаю таблицы цели (--truncate)");
    await target.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t}"`).join(", ")} CASCADE`);
    return problems;
  }
  for (const table of tables) {
    const [row] = await target.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "${table}"`);
    if (Number(row.n) > 0) problems.push(`в таблице ${table} уже ${Number(row.n)} строк — перенос идёт только в пустую базу (или --truncate)`);
  }
  return problems;
}

export async function migrateSqliteToPostgres(options: MigrateOptions): Promise<MigrateReport> {
  const log = options.log ?? ((m: string) => console.log(m));
  const batchSize = options.batchSize ?? 1000;
  const sqlitePath = path.resolve(options.sqlitePath);
  // Prisma, не найдя файл, молча создал бы пустую базу — и «перенёс» бы ничто.
  if (!fs.existsSync(sqlitePath)) throw new Error(`Файл SQLite не найден: ${sqlitePath}`);

  // Пробный прогон снимает свою копию и удаляет её в конце: настоящему переносу
  // нужен свежий снимок, сделанный уже при остановленной кассе.
  const snapshotPath = path.resolve(
    options.snapshotPath ?? (options.dryRun ? `${sqlitePath}.dry-run.db` : `${sqlitePath}.pre-postgres.db`)
  );
  if (options.dryRun) fs.rmSync(snapshotPath, { force: true });
  if (fs.existsSync(snapshotPath)) throw new Error(`Снимок уже существует: ${snapshotPath} — удалите его или укажите --snapshot`);

  const plans = buildPlans();

  log(`Снимок ${sqlitePath} → ${snapshotPath}`);
  const live = new SqliteClient({ datasourceUrl: `file:${sqlitePath}` });
  try {
    await live.$executeRawUnsafe(`VACUUM INTO '${snapshotPath.replace(/'/g, "''")}'`);
  } finally {
    await live.$disconnect();
  }
  const snapshotSha1 = crypto.createHash("sha1").update(fs.readFileSync(snapshotPath)).digest("hex");
  log(`Снимок готов, sha1 ${snapshotSha1}`);

  const source = new SqliteClient({ datasourceUrl: `file:${snapshotPath}` });
  const target = options.target ?? new PgClient();
  const tables: TableReport[] = [];
  try {
    const problems = await preflight(source, plans);
    problems.push(...(await checkTarget(target, plans, !!options.truncate && !options.dryRun, log)));
    for (const p of problems) log(`ПРОБЛЕМА: ${p}`);
    if (problems.length) return { snapshotPath, snapshotSha1, problems, tables, ok: false };

    if (options.dryRun) {
      // Полное чтение: строка, которую Prisma не может прочитать (дата в
      // секундах, Int вне диапазона, битый UTF-8), роняет всю пачку.
      for (const plan of plans) {
        const { count } = await digest((source as unknown as Record<string, Delegate>)[plan.delegate], plan, batchSize);
        tables.push({ model: plan.name, source: count, target: null, digestMatches: null });
        log(`  ${plan.name}: ${count} строк читаются`);
      }
      log("Пробный прогон: всё читается, проблем нет. Ничего не записано.");
      return { snapshotPath, snapshotSha1, problems, tables, ok: true };
    }

    for (const plan of plans) {
      const from = (source as unknown as Record<string, Delegate>)[plan.delegate];
      const to = (target as unknown as Record<string, Delegate>)[plan.delegate];
      const patches: { pk: unknown[]; values: unknown[] }[] = [];
      let copied = 0;
      for await (const rows of readAll(from, plan, batchSize)) {
        const data = rows.map((row) => {
          const out: Row = {};
          for (const f of plan.scalars) out[f] = row[f];
          if (plan.selfRefs.length) {
            const values = plan.selfRefs.map((r) => row[r.field] ?? null);
            if (values.some((v) => v !== null)) patches.push({ pk: plan.primaryKey.map((k) => row[k]), values });
            for (const r of plan.selfRefs) out[r.field] = null;
          }
          return out;
        });
        // createMany не трогает переданные createdAt/updatedAt — время строк
        // сохраняется таким, каким было в SQLite.
        copied += (await to.createMany({ data })).count;
      }
      // Второй проход — ссылки на ту же таблицу. Сырым UPDATE, а не через
      // Prisma: иначе @updatedAt выставил бы всем категориям «сейчас».
      for (const patch of patches) {
        const sets = plan.selfRefs.map((r, i) => `"${r.column}" = $${i + 1}`).join(", ");
        const where = plan.pkColumns.map((c, i) => `"${c}" = $${plan.selfRefs.length + i + 1}`).join(" AND ");
        await target.$executeRawUnsafe(`UPDATE "${plan.table}" SET ${sets} WHERE ${where}`, ...patch.values, ...patch.pk);
      }
      log(`  ${plan.name}: ${copied} строк${patches.length ? `, ${patches.length} ссылок на родителя` : ""}`);
    }

    // Счётчики номеров заказов. Без них первая продажа сама создала бы
    // счётчик от максимума — но явная строка нагляднее и проверяема.
    await target.$executeRawUnsafe(
      `INSERT INTO order_counters (tenant_id, last_number)
       SELECT tenant_id, MAX(order_number) FROM orders GROUP BY tenant_id
       ON CONFLICT (tenant_id) DO UPDATE SET last_number = GREATEST(order_counters.last_number, EXCLUDED.last_number)`
    );

    log("Сверка…");
    let ok = true;
    for (const plan of plans) {
      const a = await digest((source as unknown as Record<string, Delegate>)[plan.delegate], plan, batchSize);
      const b = await digest((target as unknown as Record<string, Delegate>)[plan.delegate], plan, batchSize);
      const matches = a.count === b.count && a.hash === b.hash;
      ok &&= matches;
      tables.push({ model: plan.name, source: a.count, target: b.count, digestMatches: matches });
      log(`  ${matches ? "ok " : "РАСХОЖДЕНИЕ"} ${plan.name}: ${a.count} → ${b.count}`);
    }
    log(ok ? "Перенос завершён, все таблицы совпадают." : "Есть расхождения — Postgres не включать, разобраться.");
    return { snapshotPath, snapshotSha1, problems, tables, ok };
  } finally {
    await source.$disconnect();
    if (!options.target) await target.$disconnect();
    if (options.dryRun && !options.snapshotPath) fs.rmSync(snapshotPath, { force: true });
  }
}

function parseArgs(argv: string[]): MigrateOptions {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const sqlitePath = get("--sqlite");
  if (!sqlitePath) {
    throw new Error("Использование: sqlite-to-postgres --sqlite /data/qwik.db [--snapshot путь] [--dry-run] [--truncate] [--batch 1000]");
  }
  return {
    sqlitePath,
    snapshotPath: get("--snapshot"),
    dryRun: argv.includes("--dry-run"),
    truncate: argv.includes("--truncate"),
    batchSize: get("--batch") ? Number(get("--batch")) : undefined,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  Promise.resolve()
    .then(() => migrateSqliteToPostgres(parseArgs(process.argv.slice(2))))
    .then((report) => process.exit(report.ok ? 0 : 1))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
