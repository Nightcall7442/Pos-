import { PrismaClient } from "@prisma/client";

// Где живёт тестовая база. Тесты гоняются на настоящем Postgres — тот же
// движок, что в проде: блокировки строк, регистр в поиске, порядок NULL
// ведут себя так же. По умолчанию — база qwik_test в Postgres из
// docker-compose (`docker compose up -d --wait postgres`); в CI — service-
// контейнер. Другое место — через TEST_DATABASE_URL.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://qwik:qwik@127.0.0.1:5432/qwik_test?schema=public&connection_limit=5&options=-c%20TimeZone%3DUTC";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "postgres"]);

/**
 * Перед каждым прогоном тестовая база стирается целиком. Чтобы опечатка в
 * TEST_DATABASE_URL не стоила рабочей базы, стираем только базу с именем на
 * `_test` и только на локальной машине (или в CI).
 */
export function assertSafeTestDatabase(url: string): { dbName: string } {
  const parsed = new URL(url);
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!/^[a-z0-9_]+_test$/.test(dbName)) {
    throw new Error(`Тестовая база должна называться *_test (сейчас «${dbName}») — она стирается перед каждым прогоном`);
  }
  if (!LOCAL_HOSTS.has(parsed.hostname) && !process.env.CI) {
    throw new Error(`Тестовая база на «${parsed.hostname}» — стирать можно только локальную базу или базу в CI`);
  }
  return { dbName };
}

// Стирает тестовую базу и создаёт её заново. `prisma migrate reset` здесь не
// годится: он требует подтверждения, когда его запускает не человек, а схема
// public целиком — это и есть вся база приложения.
export async function resetTestDatabase(url: string): Promise<void> {
  const { dbName } = assertSafeTestDatabase(url);

  const maintenance = new URL(url);
  maintenance.pathname = "/postgres";
  maintenance.search = "";
  const admin = new PrismaClient({ datasourceUrl: maintenance.toString() });
  try {
    const exists = await admin.$queryRaw<{ n: number }[]>`SELECT 1 AS n FROM pg_database WHERE datname = ${dbName}`;
    // Имя уже проверено регуляркой в assertSafeTestDatabase.
    if (exists.length === 0) await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  } catch (error) {
    const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
    throw new Error(`Не удалось подключиться к тестовому Postgres (${maintenance.host}): ${reason}. Локально: docker compose up -d --wait postgres, или задайте TEST_DATABASE_URL`);
  } finally {
    await admin.$disconnect();
  }

  const db = new PrismaClient({ datasourceUrl: url });
  try {
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS public CASCADE`);
    await db.$executeRawUnsafe(`CREATE SCHEMA public`);
    // Поиск без учёта регистра (ILIKE) складывает кириллицу, только если у
    // базы правильная локаль. С локалью C «Молоко» не находится по «молоко»,
    // и тесты поиска падали бы с непонятной причиной.
    const [locale] = await db.$queryRaw<{ ok: boolean }[]>`SELECT lower('МОЛОКО') = 'молоко' AND 'Молоко' ILIKE 'молоко' AS ok`;
    if (!locale?.ok) {
      throw new Error("Локаль тестовой базы не складывает кириллицу (LC_CTYPE=C?). Нужен Postgres с ICU или en_US.UTF-8, как в проде");
    }
  } finally {
    await db.$disconnect();
  }
}


/** Та же тестовая база, но с другим именем — для тестов, которым нужна своя. */
export function siblingTestDatabase(name: string): string {
  const url = new URL(TEST_DATABASE_URL);
  url.pathname = `/${name}`;
  return url.toString();
}
