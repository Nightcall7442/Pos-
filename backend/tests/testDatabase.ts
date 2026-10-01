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
