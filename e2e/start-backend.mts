// Бэкенд для сквозных тестов: своя база qwik_e2e_test, свежая схема, демо-данные
// из prisma/seed.ts — и сервер на своём порту. Всё в одной команде, чтобы
// Playwright запускал сервер строго после подготовки базы.
import { execSync, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resetTestDatabase, siblingTestDatabase } from "../backend/tests/testDatabase.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(root, "backend");
const tsxCli = path.join(backend, "node_modules", "tsx", "dist", "cli.mjs");

export const E2E_BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT || 3200);
const DATABASE_URL = siblingTestDatabase("qwik_e2e_test");

const env = {
  ...process.env,
  DATABASE_URL,
  NODE_ENV: "test",
  PORT: String(E2E_BACKEND_PORT),
  JWT_SECRET: "e2e-access-secret-value-0123456789",
  JWT_REFRESH_SECRET: "e2e-refresh-secret-value-0123456789",
  AUTH_RATE_LIMIT_MAX: "1000",
  CATALOG_LIVE_LOOKUP: "off",
  LOG_LEVEL: "error",
};

await resetTestDatabase(DATABASE_URL);
execSync("npx prisma migrate deploy", { cwd: backend, env, stdio: "inherit" });
execSync(`"${process.execPath}" "${tsxCli}" prisma/seed.ts`, { cwd: backend, env, stdio: "inherit" });

const server = spawn(process.execPath, [tsxCli, "src/index.ts"], { cwd: backend, env, stdio: "inherit" });
server.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.kill(signal));
}
