import { spawn, execSync, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";

// The suite talks to a real HTTP server. It used to expect one already running
// on the development port and wiped the development database as it went; now
// it starts its own server on its own SQLite file, and touches nothing else.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dbPath = path.join(root, "prisma", "test.db");
const DATABASE_URL = "file:./test.db";
const PORT = Number(process.env.TEST_PORT || 3100);

let server: ChildProcess | undefined;
let offStub: http.Server | undefined;
const OFF_PORT = Number(process.env.TEST_OFF_PORT || 3199);

// Stands in for Open Food Facts, so the live barcode lookup is tested without
// the network: one product it "knows", 404 for every other code, and a counter
// (GET /__hits/<code>) that shows how often the API was really asked.
const OFF_KNOWN = "4607000000014";
const offHits = new Map<string, number>();

function startOffStub(): Promise<void> {
  offStub = http.createServer((req, res) => {
    const url = req.url ?? "";
    const counted = url.match(/^\/__hits\/(\d+)$/);
    if (counted) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ hits: offHits.get(counted[1]) ?? 0 }));
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

  for (const suffix of ["", "-journal"]) {
    fs.rmSync(dbPath + suffix, { force: true });
  }

  const env = {
    ...process.env,
    DATABASE_URL,
    NODE_ENV: "test",
    PORT: String(PORT),
    JWT_SECRET: "test-jwt-secret-value-0123456789",
    JWT_REFRESH_SECRET: "test-refresh-secret-value-0123456789",
    LOG_LEVEL: "error",
    OFF_BASE_URL: `http://127.0.0.1:${OFF_PORT}`,
  };

  await startOffStub();
  execSync("npx prisma migrate deploy", { cwd: root, env, stdio: "ignore" });

  // `npx` spawns tsx as a child of its own, so the whole process group is
  // signalled on teardown — killing only the wrapper used to leave a server
  // behind that the next run then talked to instead of its own.
  server = spawn("npx", ["tsx", "src/index.ts"], { cwd: root, env, stdio: "ignore", detached: true });
  await waitForHealth(`http://127.0.0.1:${PORT}/health`);
}

export async function teardown(): Promise<void> {
  offStub?.close();
  if (!server?.pid) return;
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
