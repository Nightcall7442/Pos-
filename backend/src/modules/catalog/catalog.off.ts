import { getEnv } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import { shelfFor } from "./categories.js";
import { cleanBrand, cleanName, normalizeQuantity } from "./names.js";

// Open Food Facts and its sister projects (© contributors, ODbL) share one API:
// food first, then cosmetics and general goods, which fill the rest of a shop.
const SOURCES = ["https://world.openfoodfacts.org", "https://world.openbeautyfacts.org", "https://world.openproductsfacts.org"];
const USER_AGENT = "QwikPOS/1.0 (hello@qwik.uz)";
const FIELDS = "code,product_name,product_name_ru,generic_name,brands,quantity,categories_tags";
const TIMEOUT_MS = 4000;

// The public API allows about 100 product reads a minute from one address;
// staying under that keeps us a welcome guest.
const MAX_REQUESTS_PER_MINUTE = 80;
const stamps: number[] = [];

function budgetLeft(): boolean {
  const now = Date.now();
  while (stamps.length > 0 && now - stamps[0] > 60_000) stamps.shift();
  return stamps.length < MAX_REQUESTS_PER_MINUTE;
}

export interface LiveProduct {
  name: string;
  brand: string | null;
  quantity: string | null;
  category: string | null;
}

/** Turns one API product into a catalogue entry; null when it has nothing a shop could use. */
export function toLiveProduct(product: Record<string, unknown>): LiveProduct | null {
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const name = cleanName(text(product.product_name_ru) || text(product.product_name) || text(product.generic_name));
  if (name.length < 2 || /^[\d\s.,-]+$/.test(name)) return null;
  return {
    name,
    brand: cleanBrand(text(product.brands)),
    quantity: normalizeQuantity(text(product.quantity)),
    category: shelfFor(Array.isArray(product.categories_tags) ? (product.categories_tags as string[]) : text(product.categories_tags)),
  };
}

interface Answer {
  product: LiveProduct | null;
  /** false when the source could not be asked or did not answer — "not found" is then not a fact. */
  ok: boolean;
}

async function ask(base: string, code: string): Promise<Answer> {
  if (!budgetLeft()) return { product: null, ok: false };
  stamps.push(Date.now());
  try {
    const res = await fetch(`${base}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 404) return { product: null, ok: true };
    if (!res.ok) return { product: null, ok: false };
    const body = (await res.json()) as { status?: number; product?: Record<string, unknown> };
    if (body.status !== 1 || !body.product) return { product: null, ok: true };
    return { product: toLiveProduct(body.product), ok: true };
  } catch (error) {
    logger.warn("Catalogue live lookup failed", { base, message: error instanceof Error ? error.message : String(error) });
    return { product: null, ok: false };
  }
}

/**
 * One barcode, asked of the public catalogues. `complete` says whether every
 * source answered — only then is "nobody knows this code" worth remembering.
 */
export async function liveLookup(code: string): Promise<{ product: LiveProduct | null; complete: boolean }> {
  const env = getEnv();
  if (env.CATALOG_LIVE_LOOKUP === "off") return { product: null, complete: false };
  const sources = env.OFF_BASE_URL ? [env.OFF_BASE_URL] : SOURCES;

  // Food is what most codes are: ask it alone first, and bother the others only on a miss.
  const food = await ask(sources[0], code);
  if (food.product) return { product: food.product, complete: true };

  const rest = await Promise.all(sources.slice(1).map((base) => ask(base, code)));
  const found = rest.find((answer) => answer.product);
  if (found) return { product: found.product, complete: true };
  return { product: null, complete: food.ok && rest.every((answer) => answer.ok) };
}

/** Is Open Food Facts reachable from here? Asked once at start, so the logs say so before anyone scans. */
export async function probeOff(): Promise<boolean> {
  const env = getEnv();
  if (env.CATALOG_LIVE_LOOKUP === "off") return false;
  return (await ask(env.OFF_BASE_URL ?? SOURCES[0], "5449000000996")).ok;
}
