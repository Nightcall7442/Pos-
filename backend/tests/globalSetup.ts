import { spawn, execSync, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

// The suite talks to a real HTTP server. It used to expect one already running
// on the development port and wiped the development database as it went; now
// it starts its own server on its own SQLite file, and touches nothing else.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dbPath = path.join(root, "prisma", "test.db");
const DATABASE_URL = "file:./test.db";
const PORT = Number(process.env.TEST_PORT || 3100);

let server: ChildProcess | undefined;

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
  };

  execSync("npx prisma migrate deploy", { cwd: root, env, stdio: "ignore" });

  // `npx` spawns tsx as a child of its own, so the whole process group is
  // signalled on teardown — killing only the wrapper used to leave a server
  // behind that the next run then talked to instead of its own.
  server = spawn("npx", ["tsx", "src/index.ts"], { cwd: root, env, stdio: "ignore", detached: true });
  await waitForHealth(`http://127.0.0.1:${PORT}/health`);
}

export async function teardown(): Promise<void> {
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
