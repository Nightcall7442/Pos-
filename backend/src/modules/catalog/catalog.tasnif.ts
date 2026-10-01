import { getEnv } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import type { LiveProduct } from "./catalog.off.js";
import { shelfFromIkpu } from "./categories.js";
import { cleanBrand, cleanName, normalizeQuantity } from "./names.js";

// The Unified Electronic National Catalogue of goods and services (tasnif.soliq.uz),
// kept by the State Tax Committee of Uzbekistan. Every line of an invoice or a fiscal
// receipt in Uzbekistan must carry the goods' IKPU code from this catalogue, so it knows
// what is really sold in the country — by barcode, with the brand, the pack and the
// code the law asks for. It answers the same search that the portal's own barcode field
// runs; we ask it once per code, a few a minute, and remember the answer.
const DEFAULT_BASE = "https://tasnif.soliq.uz/api/cls-api";
const USER_AGENT = "QwikPOS/1.0 (hello@qwik.uz)";
const TIMEOUT_MS = 4000;
const MAX_REQUESTS_PER_MINUTE = 40;
const stamps: number[] = [];

function budgetLeft(): boolean {
  const now = Date.now();
  while (stamps.length > 0 && now - stamps[0] > 60_000) stamps.shift();
  return stamps.length < MAX_REQUESTS_PER_MINUTE;
}

export interface TasnifProduct extends LiveProduct {
  /** the 17-digit IKPU code the invoice and the receipt need */
  ikpu: string;
}

// Packaging says nothing about what the thing is: "ПЭТ бутылка", "Тетра Пак", "полипропиленовый стакан".
// (JavaScript's \w is ASCII-only, so a Cyrillic word ending is \p{L}*.)
const MATERIAL = "стеклянн\\p{L}*|пластиков\\p{L}*|пластмассов\\p{L}*|жестян\\p{L}*|алюминиев\\p{L}*|бумажн\\p{L}*|картонн\\p{L}*|полипропиленов\\p{L}*|полиэтиленов\\p{L}*|полистирольн\\p{L}*|металлизированн\\p{L}*|фольгированн\\p{L}*|вакуумн\\p{L}*";
const VESSEL = "бутылк\\p{L}*|пакет\\p{L}*|стакан\\p{L}*|чашк\\p{L}*|банк\\p{L}*|коробк\\p{L}*|упаковк\\p{L}*|контейнер\\p{L}*|ведр\\p{L}*|туб\\p{L}*|флакон\\p{L}*|пленк\\p{L}*|брик\\p{L}*";
const PACKAGING = new RegExp(
  `(?<![\\p{L}])(?:(?:${MATERIAL})\\s+(?:${VESSEL})|(?:пэт|пет)(?:\\s+(?:${VESSEL}))?|тетра\\s*-?\\s*(?:пак|брик)\\p{L}*|(?:\\d+\\s*-?\\s*)?твист\\s*-?\\s*офф|крышк\\p{L}*|${VESSEL})(?![\\p{L}])`,
  "giu"
);
const MEASURE = /(\d+(?:[.,]\d+)?)(?:\s*±\s*\d+(?:[.,]\d+)?)?\s*(кг|гр|г|грамм\p{L}*|мл|л|литр\p{L}*|шт)\.?(?![\p{L}])/giu;

/** "сладкий, ПЭТ бутылка 1,5 л." → { rest: "сладкий", quantity: "1,5 л" } */
function splitAttribute(attribute: string): { rest: string; quantity: string | null } {
  let measure: RegExpExecArray | null = null;
  for (const hit of attribute.matchAll(MEASURE)) measure = hit;
  let quantity: string | null = null;
  let text = attribute;
  if (measure) {
    const unit = measure[2].toLowerCase();
    quantity = normalizeQuantity(`${measure[1]} ${unit.startsWith("литр") ? "л" : unit.startsWith("грамм") ? "г" : unit}`);
    text = text.replace(measure[0], " ");
  }
  const rest = text
    .replace(PACKAGING, " ")
    .replace(/\s*,\s*(?:,\s*)+/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, "")
    .replace(/\s+,/g, ",");
  return { rest, quantity };
}

const compact = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** The kind of goods as a shop would say it: "Колбасы (всех видов)" → "Колбасы"; the vague ones say nothing. */
function shortKind(kind: string): string {
  const short = kind
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+разных\s+видов$/iu, "")
    .replace(/\s+упакованн\p{L}*$/iu, "")
    .trim();
  return /^(?:прочие|безалкогольные|сокосодержащие)(?![\p{L}])/iu.test(short) ? "" : short;
}

/** "Пиво" + "Viking" + "Пастеризованное фильтрованное крепость 4,4%" — the kind only when it is short and not said already. */
function composeName(kind: string, brand: string | null, rest: string): string {
  const short = shortKind(kind);
  const stem = compact(short).slice(0, 5);
  // "Fanta" + "Fanta Orange": the brand that the description starts with is not said twice.
  const brandSaid = brand !== null && compact(rest).startsWith(compact(brand));
  const said = stem.length >= 4 && (compact(rest).includes(stem) || (brand !== null && compact(brand).includes(stem)));
  return cleanName([short.length > 0 && short.length <= 24 && !said ? short : "", brandSaid ? "" : brand ?? "", rest].filter(Boolean).join(" "));
}

/** One record of the catalogue → what a shop needs: a name to start from, the pack size, a shelf and the IKPU. */
export function toTasnifProduct(record: Record<string, unknown>): TasnifProduct | null {
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const ikpu = text(record.mxikCode);
  if (!/^\d{17}$/.test(ikpu)) return null;

  const brand = cleanBrand(text(record.brandName));
  const kind = text(record.subPositionName) || text(record.positionName);
  const attribute = text(record.attributeName);
  const { rest, quantity } = splitAttribute(attribute);
  const name = composeName(kind, brand, rest);
  if (name.length < 2) return null;
  // A flavour is not what the goods are (chips "со вкусом сметаны" are not dairy), and "не замороженные" is not frozen.
  const described = `${kind} ${attribute}`.replace(/со\s+вкусом\s+[^,]*/giu, " ").replace(/не\s+замороженн\p{L}*/giu, " ");
  return { name, brand, quantity, category: shelfFromIkpu(ikpu, described, text(record.positionName)), ikpu };
}

interface Answer {
  product: TasnifProduct | null;
  /** false when the catalogue could not be asked or did not answer — "not found" is then not a fact. */
  ok: boolean;
}

async function ask(code: string, timeoutMs: number): Promise<Answer> {
  if (!budgetLeft()) return { product: null, ok: false };
  stamps.push(Date.now());
  const base = getEnv().TASNIF_BASE_URL ?? DEFAULT_BASE;
  try {
    const res = await fetch(`${base}/mxik/search/by-params?gtin=${encodeURIComponent(code)}&size=3&lang=ru`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { product: null, ok: false };
    const body = (await res.json()) as { success?: boolean; data?: { content?: Record<string, unknown>[] } };
    if (body.success === false) return { product: null, ok: false };
    for (const record of body.data?.content ?? []) {
      const product = toTasnifProduct(record);
      if (product) return { product, ok: true };
    }
    return { product: null, ok: true };
  } catch (error) {
    logger.warn("National catalogue lookup failed", { message: error instanceof Error ? error.message : String(error) });
    return { product: null, ok: false };
  }
}

/** One barcode, asked of the national catalogue. `complete` — it answered, so an empty answer is a fact. */
export async function liveTasnif(code: string, timeoutMs = TIMEOUT_MS): Promise<{ product: TasnifProduct | null; complete: boolean }> {
  if (getEnv().CATALOG_LIVE_LOOKUP === "off") return { product: null, complete: false };
  const answer = await ask(code, timeoutMs);
  return { product: answer.product, complete: answer.ok };
}

/** Is the catalogue reachable from here? Asked once at start, so the logs say so before anyone scans. */
export async function probeTasnif(): Promise<boolean> {
  if (getEnv().CATALOG_LIVE_LOOKUP === "off") return false;
  return (await ask("5449000000996", TIMEOUT_MS)).ok;
}
