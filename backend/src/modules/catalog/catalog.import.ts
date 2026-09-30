import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { logger } from "../../utils/logger.js";
import { canonicalBarcode } from "./gtin.js";

const here = path.dirname(fileURLToPath(import.meta.url));
// src/modules/catalog → backend/catalog when run from source; dist/modules/catalog → /app/catalog in the image.
export const SNAPSHOT_FILE = path.resolve(here, "../../../catalog/catalog.jsonl.gz");

const BATCH = 1000;

interface SnapshotRow {
  b: string;
  n: string;
  br?: string;
  q?: string;
  c?: string;
}

async function writeBatch(db: PrismaClient, rows: Map<string, SnapshotRow>, now: number): Promise<void> {
  const entries = Array.from(rows.entries());
  const placeholders = entries.map(() => "(?, ?, ?, ?, ?, 'snapshot', 1, ?, ?)").join(", ");
  const params = entries.flatMap(([barcode, row]) => [barcode, row.n, row.br ?? null, row.q ?? null, row.c ?? null, now, now]);
  // Rows a shop or the live lookup added are not the snapshot's to overwrite.
  await db.$executeRawUnsafe(
    `INSERT INTO catalog_products (barcode, name, brand, quantity, category, source, confirmations, created_at, updated_at)
     VALUES ${placeholders}
     ON CONFLICT(barcode) DO UPDATE SET name = excluded.name, brand = excluded.brand, quantity = excluded.quantity,
       category = excluded.category, updated_at = excluded.updated_at
     WHERE catalog_products.source = 'snapshot'`,
    ...params
  );
}

let running: Promise<{ skipped: boolean; rows: number }> | null = null;

/**
 * Loads the catalogue shipped with the app (backend/catalog/catalog.jsonl.gz)
 * into the database. Idempotent: the file's hash is remembered, so a restart
 * costs nothing, and a new snapshot simply refreshes the rows of the old one.
 */
export function importSnapshot(file = SNAPSHOT_FILE): Promise<{ skipped: boolean; rows: number }> {
  running ??= run(file).finally(() => {
    running = null;
  });
  return running;
}

async function run(file: string): Promise<{ skipped: boolean; rows: number }> {
  if (!fs.existsSync(file)) {
    logger.warn("Barcode catalogue snapshot not found — starting without it", { file });
    return { skipped: true, rows: 0 };
  }

  const version = crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex");

  // A client of its own, without the development query log: a thousand-row INSERT
  // echoed a hundred and thirty times would bury everything else in the console.
  const db = new PrismaClient({ log: ["error"] });
  try {
    const loaded = await db.catalogMeta.findUnique({ where: { key: "snapshot_version" } });
    if (loaded?.value === version) return { skipped: true, rows: 0 };

    const started = Date.now();
    const lines = readline.createInterface({ input: fs.createReadStream(file).pipe(zlib.createGunzip()), crlfDelay: Infinity });
    let batch = new Map<string, SnapshotRow>();
    let rows = 0;
    for await (const line of lines) {
      if (!line) continue;
      let row: SnapshotRow;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }
      if (typeof row.b !== "string" || !/^\d{8,14}$/.test(row.b) || typeof row.n !== "string" || row.n.length < 2) continue;
      batch.set(canonicalBarcode(row.b), row);
      rows++;
      if (batch.size >= BATCH) {
        await writeBatch(db, batch, Date.now());
        batch = new Map();
      }
    }
    if (batch.size > 0) await writeBatch(db, batch, Date.now());

    // Recorded last: an import cut short by a restart runs again from the top.
    await db.catalogMeta.upsert({ where: { key: "snapshot_version" }, create: { key: "snapshot_version", value: version }, update: { value: version } });
    logger.info("Barcode catalogue loaded", { rows, seconds: Math.round((Date.now() - started) / 100) / 10 });
    return { skipped: false, rows };
  } finally {
    await db.$disconnect();
  }
}
