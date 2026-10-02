import { spawn, execSync, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import http from "node:http";
import { TEST_DATABASE_URL, resetTestDatabase } from "./testDatabase.js";

// The suite talks to a real HTTP server. It used to expect one already running
// on the development port and wiped the development database as it went; now
// it starts its own server on its own database (qwik_test, see testDatabase.ts),
// and touches nothing else.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const DATABASE_URL = TEST_DATABASE_URL;
const PORT = Number(process.env.TEST_PORT || 3100);


let server: ChildProcess | undefined;
let offStub: http.Server | undefined;
const OFF_PORT = Number(process.env.TEST_OFF_PORT || 3199);

// Stands in for Open Food Facts, so the live barcode lookup is tested without
// the network: one product it "knows", 404 for every other code, and a counter
// (GET /__hits/<code>) that shows how often the API was really asked.
const OFF_KNOWN = "4607000000014";
const offHits = new Map<string, number>();

// …and the national catalogue of Uzbekistan (tasnif.soliq.uz), at /tasnif. It knows three codes:
// a dairy product nobody else has described, a beer (the shipped snapshot calls it just "viking"),
// and the one Open Food Facts knows too — to show whose words win.
const TASNIF_RECORDS: Record<string, Record<string, string>> = {
  "4780000000014": { mxikCode: "00403999008070006", brandName: "Pure-Milk", attributeName: "сметана жирность 20%, полипропиленовый стакан 180±5 г.", subPositionName: "Сметана", positionName: "Прочие кисломолочные продукты" },
  "4780000000021": { mxikCode: "02203001001286001", brandName: "VIKING", attributeName: "Пастеризованное фильтрованное крепость 4,4% стеклянная бутылка 0,65 л", subPositionName: "Пиво", positionName: "Пиво" },
  [OFF_KNOWN]: { mxikCode: "01905012001444068", brandName: "ACME", attributeName: "шоколадное, пакет 250 г", subPositionName: "Печенье разных видов", positionName: "Печенье" },
};
const tasnifHits = new Map<string, number>();

function startOffStub(): Promise<void> {
  offStub = http.createServer((req, res) => {
    const url = req.url ?? "";
    const counted = url.match(/^\/__hits\/(tasnif\/)?(\d+)$/);
    if (counted) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ hits: (counted[1] ? tasnifHits : offHits).get(counted[2]) ?? 0 }));
      return;
    }
    const national = url.match(/^\/tasnif\/mxik\/search\/by-params\?.*gtin=(\d+)/);
    if (national) {
      tasnifHits.set(national[1], (tasnifHits.get(national[1]) ?? 0) + 1);
      const record = TASNIF_RECORDS[national[1]];
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: true, code: 0, reason: "ok", data: { content: record ? [{ internationalCode: national[1], ...record }] : [], totalElements: record ? 1 : 0 } }));
      return;
    }
    const asked = url.match(/^\/api\/v2\/product\/(\d+)\.json/);
    if (!asked) {
      res.statusCode = 404;
      res.end();
      return;
    }
    offHits.set(asked[1], (offHits.get(asked[1]) ?? 0) + 1);
    res.setHeader("Content-Type", "application/json");
    if (asked[1] === OFF_KNOWN) {
      res.end(JSON.stringify({ code: asked[1], status: 1, product: { product_name: "Choco &amp; Nuts", brands: "Acme, Other", quantity: "250 G", categories_tags: ["en:snacks", "en:sweet-snacks", "en:chocolates"] } }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ code: asked[1], status: 0, status_verbose: "no code or invalid code" }));
    }
  });
  return new Promise((resolve) => offStub!.listen(OFF_PORT, "127.0.0.1", resolve));
}

async function waitForHealth(url: string, timeoutMs = 30000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Test server did not become healthy at ${url}`);
}

export async function setup(): Promise<void> {
  // Refuse to run against a port that is already serving something: a stray
  // server from an earlier run would answer with another database.
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/health`);
    if (res.ok) throw new Error(`Port ${PORT} is already in use — stop the process before running tests`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("already in use")) throw error;
  }

  await resetTestDatabase(DATABASE_URL);

  const env = {
    ...process.env,
    DATABASE_URL,
    NODE_ENV: "test",
    PORT: String(PORT),
    JWT_SECRET: "test-jwt-secret-value-0123456789",
    JWT_REFRESH_SECRET: "test-refresh-secret-value-0123456789",
    LOG_LEVEL: "error",
    AUTH_RATE_LIMIT_MAX: "1000",
    OFF_BASE_URL: `http://127.0.0.1:${OFF_PORT}`,
    TASNIF_BASE_URL: `http://127.0.0.1:${OFF_PORT}/tasnif`,
  };

  await startOffStub();
  execSync("npx prisma migrate deploy", { cwd: root, env, stdio: "ignore" });

  // Запускаем tsx напрямую через node, а не через npx: на Windows `spawn("npx")`
  // падает с ENOENT (npx — это npx.cmd, и без shell его не найти), из-за чего
  // весь набор тестов на Windows вообще не стартовал. Прямой запуск к тому же
  // убирает лишний процесс-обёртку: гасить на teardown нужно ровно один pid.
  const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
  server = spawn(process.execPath, [tsxCli, "src/index.ts"], {
    cwd: root,
    env,
    stdio: "ignore",
    // POSIX: своя группа процессов, чтобы teardown погасил всё дерево разом.
    // На Windows групп процессов нет — там дерево обходит taskkill /T.
    detached: process.platform !== "win32",
  });
  await waitForHealth(`http://127.0.0.1:${PORT}/health`);
}

export async function teardown(): Promise<void> {
  offStub?.close();
  if (!server?.pid) return;

  // На Windows process.kill(-pid) не работает: отрицательный pid там не
  // означает группу, вызов падает, и сервер остаётся слушать тестовый порт —
  // следующий запуск упёрся бы в «Port 3100 is already in use».
  if (process.platform === "win32") {
    try {
      execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: "ignore" });
    } catch {
      // уже завершился
    }
    return;
  }

  const pgid = -server.pid;
  try {
    process.kill(pgid, "SIGTERM");
  } catch {
    // already gone
  }
  await new Promise((r) => setTimeout(r, 500));
  try {
    process.kill(pgid, "SIGKILL");
  } catch {
    // expected once the group has exited
  }
}
