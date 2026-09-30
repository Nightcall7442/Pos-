/**
 * Builds the barcode catalogue snapshot that ships with Qwik
 * (backend/catalog/catalog.jsonl.gz).
 *
 * Source: the Open Food Facts product dump (https://world.openfoodfacts.org,
 * © Open Food Facts contributors, Open Database License 1.0). It is ~1.3 GB, so
 * it is streamed and filtered on the fly; only what a shop in Uzbekistan is
 * likely to scan is kept:
 *   - goods sold in Uzbekistan and its neighbours (Russia, Kazakhstan, Turkey…),
 *   - goods whose barcode was issued in those countries,
 *   - and the most scanned goods in the world (global brands on every shelf).
 * Anything else is still found — one scan at a time — through the live lookup.
 *
 * Two steps, so the thresholds can be tuned without downloading again:
 *   npx tsx scripts/build-catalog.ts fetch  <candidates.jsonl>            # ~5 min
 *   npx tsx scripts/build-catalog.ts fetch  <candidates.jsonl> <dumpUrl>  # add a sister catalogue (same format)
 *   npx tsx scripts/build-catalog.ts pack   <candidates.jsonl> [minScans] # seconds
 */
import fs from "node:fs";
import zlib from "node:zlib";
import readline from "node:readline";
import { Readable } from "node:stream";
import { hasRegionalPrefix, hasTradePrefix, isCatalogBarcode } from "../src/modules/catalog/gtin.js";
import { cleanBrand, cleanName, normalizeQuantity } from "../src/modules/catalog/names.js";
import { shelfFor } from "../src/modules/catalog/categories.js";

const DUMP_URL = "https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz";
// The sister projects publish dumps in the same format: cosmetics, household goods, pet food.
const USER_AGENT = "QwikPOS/1.0 (hello@qwik.uz)";
const REGION = new Set([
  "en:uzbekistan", "en:kazakhstan", "en:kyrgyzstan", "en:tajikistan", "en:turkmenistan",
  "en:russia", "en:belarus", "en:ukraine", "en:azerbaijan", "en:armenia", "en:georgia", "en:moldova", "en:turkey",
]);

// Raw as the dump has it: the derived fields (shelf, tidy quantity) are worked
// out in `pack`, so their rules can be tuned without downloading again.
interface Candidate {
  b: string; // barcode
  n: string; // name
  br?: string; // brands, as written
  q?: string; // quantity, as written
  t?: string; // English category tags, comma-separated
  s: number; // unique scans on Open Food Facts — how popular
  k: number; // number of countries it is sold in
  r: 0 | 1; // regional: sold in / issued in the region
}

// Contributors leave all sorts of leftovers in the name field.
const usableName = (name: string) => name.length >= 3 && !/^[\d\s.,-]+$/.test(name) && !/https?:|www\./i.test(name);

async function fetchCandidates(out: string, url: string, append: boolean): Promise<void> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok || !res.body) throw new Error(`dump: HTTP ${res.status}`);
  const lines = readline.createInterface({ input: Readable.fromWeb(res.body as never).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  const sink = fs.createWriteStream(out, { flags: append ? "a" : "w" });

  let header: Record<string, number> | null = null;
  let read = 0;
  let kept = 0;
  for await (const line of lines) {
    if (!header) {
      header = Object.fromEntries(line.split("\t").map((name, index) => [name, index]));
      continue;
    }
    if (++read % 250_000 === 0) console.log(`  прочитано ${read.toLocaleString("ru")}, отобрано ${kept.toLocaleString("ru")}`);

    const f = line.split("\t");
    const code = f[header.code];
    if (!isCatalogBarcode(code)) continue;
    const name = cleanName(f[header.product_name] || f[header.generic_name] || f[header.abbreviated_product_name]);
    if (!usableName(name)) continue;

    const countries = (f[header.countries_tags] || "").split(",").filter(Boolean);
    const regional = countries.some((c) => REGION.has(c)) || hasRegionalPrefix(code) ? 1 : 0;
    const scans = Number(f[header.unique_scans_n]) || 0;
    // Loose on purpose — the real cut is made in `pack`.
    if (!regional && scans < 3 && countries.length < 3) continue;

    const c: Candidate = { b: code, n: name, s: scans, k: countries.length, r: regional as 0 | 1 };
    const brand = (f[header.brands] || "").trim();
    if (brand) c.br = brand.slice(0, 120);
    const quantity = (f[header.quantity] || "").trim();
    if (quantity) c.q = quantity.slice(0, 60);
    const tags = (f[header.categories_tags] || "").split(",").filter((tag) => tag.startsWith("en:"));
    if (tags.length) c.t = tags.join(",").slice(0, 700);
    sink.write(JSON.stringify(c) + "\n");
    kept++;
  }
  sink.end();
  console.log(`Готово: прочитано ${read.toLocaleString("ru")}, кандидатов ${kept.toLocaleString("ru")} → ${out}`);
}

async function pack(candidates: string, minScans: number): Promise<void> {
  const rows: Candidate[] = [];
  for await (const line of readline.createInterface({ input: fs.createReadStream(candidates), crlfDelay: Infinity })) {
    if (!line) continue;
    const row: Candidate = JSON.parse(line);
    if (usableName(row.n) && isCatalogBarcode(row.b)) rows.push(row);
  }
  // Regional goods all stay; goods of the wider trade partners need a few scans;
  // everything else must be popular worldwide to earn its place.
  const kept = rows.filter((row) => row.r === 1 || (hasTradePrefix(row.b) && row.s >= 3) || row.s >= minScans);
  const regional = kept.filter((row) => row.r === 1).length;

  const out = "catalog/catalog.jsonl.gz";
  fs.mkdirSync("catalog", { recursive: true });
  const gzip = zlib.createGzip({ level: 9 });
  const sink = fs.createWriteStream(out);
  gzip.pipe(sink);
  for (const row of kept) {
    const br = cleanBrand(row.br);
    const q = normalizeQuantity(row.q);
    const c = shelfFor(row.t);
    gzip.write(JSON.stringify({ b: row.b, n: row.n, ...(br && { br }), ...(q && { q }), ...(c && { c }) }) + "\n");
  }
  gzip.end();
  await new Promise<void>((resolve) => sink.on("finish", () => resolve()));

  const bytes = fs.statSync(out).size;
  console.log(`Кандидатов ${rows.length.toLocaleString("ru")} → в снимок ${kept.length.toLocaleString("ru")} (региональных ${regional.toLocaleString("ru")}, популярных ${(kept.length - regional).toLocaleString("ru")}), размер ${(bytes / 1048576).toFixed(1)} МБ`);
}

const [mode, file, third] = process.argv.slice(2);
if (mode === "fetch" && file) await fetchCandidates(file, third || DUMP_URL, Boolean(third));
else if (mode === "pack" && file) await pack(file, Number(third) || 10);
else {
  console.error("Использование: build-catalog.ts fetch <candidates.jsonl> [dumpUrl — дописать в конец] | pack <candidates.jsonl> [minScans]");
  process.exit(1);
}
