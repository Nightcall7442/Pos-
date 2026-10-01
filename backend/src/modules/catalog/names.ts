// Names and quantities as Open Food Facts stores them are written by anyone,
// in any language: "M&amp;M white", "1.5 L", "COCA-COLA 330ML". These helpers
// turn them into something a cashier can read on a receipt.

const ENTITIES: Record<string, string> = { "&amp;": "&", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " " };

export function decodeEntities(text: string): string {
  return text
    .replace(/&(amp|quot|apos|lt|gt|nbsp);|&#39;/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

export function cleanName(raw: string | null | undefined): string {
  let name = decodeEntities(String(raw ?? "")).replace(/\s+/g, " ").trim();
  // SHOUTED names read badly on a receipt: "КОКА-КОЛА ОРИГИНАЛЬНАЯ" → "Кока-кола оригинальная".
  const letters = name.replace(/[^\p{L}]/gu, "");
  if (letters.length > 3 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) {
    name = name.charAt(0) + name.slice(1).toLowerCase();
  }
  return name.slice(0, 160);
}

const UNITS: Record<string, string> = {
  kg: "кг", кг: "кг", g: "г", gr: "г", г: "г", гр: "г", mg: "мг",
  l: "л", lt: "л", ltr: "л", л: "л", ml: "мл", мл: "мл", cl: "сл", dl: "дл",
  pcs: "шт", pc: "шт", шт: "шт", unit: "шт", units: "шт",
};

// "1.5 L" → "1,5 л", "330ML" → "330 мл", "6 x 0.33 l" → "6 × 0,33 л".
export function normalizeQuantity(raw: string | null | undefined): string | null {
  const text = decodeEntities(String(raw ?? "")).toLowerCase().replace(/\s+/g, " ").trim();
  if (!text || !/\d/.test(text)) return null; // "family pack" is not a quantity
  const converted = text
    .replace(/(\d+(?:[.,]\d+)?)\s*([a-zа-я]+)/g, (match, num: string, unit: string) => {
      const ru = UNITS[unit];
      return ru ? `${num.replace(".", ",")} ${ru}` : match;
    })
    .replace(/\s*[x×]\s*/g, " × ");
  // A number with no unit ("2") tells a shop nothing.
  if (!/\d\s?(?:кг|мг|г|л|мл|сл|дл|шт)(?![\p{L}])/u.test(converted)) return null;
  return converted.length <= 40 ? converted : null;
}

const JUNK_BRANDS = new Set(["null", "none", "unknown", "n/a", "na", "no brand", "sans marque", "generic", "нет", "не указан", "без бренда"]);

/** The first brand of "Nestlé, Kit Kat", or null when the field holds only a placeholder. */
export function cleanBrand(raw: string | null | undefined): string | null {
  const first = decodeEntities(String(raw ?? "").split(",")[0]).replace(/\s+/g, " ").trim();
  const letters = first.replace(/[^\p{L}]/gu, "");
  // A brand typed in capitals — "COCA-COLA" — reads better as "Coca-Cola" than as "Coca-cola".
  const brand = (letters.length > 3 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()
    ? first.toLowerCase().replace(/(^|[\s\-'’.])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
    : cleanName(first)
  ).slice(0, 60);
  if (brand.length < 2 || JUNK_BRANDS.has(brand.toLowerCase()) || /^[\d\s.,-]+$/.test(brand)) return null;
  return brand;
}

// The name a shop starts from — brand, name and pack size, each only if the
// name does not already say it: "Original Taste" + "1,5 л" + "Coca-Cola" →
// "Coca-Cola Original Taste 1,5 л".
export function displayName(name: string, quantity?: string | null, brand?: string | null): string {
  const compact = (text: string) => text.toLowerCase().replace(/[\s,.\-'’"«»]/g, "");
  const cyrillic = (text: string) => /\p{Script=Cyrillic}/u.test(text);
  let result = name;
  // "Кока-кола" under the brand "Coca-Cola" is the brand already — only same-script names get it prefixed.
  if (brand && brand.length <= 30 && cyrillic(brand) === cyrillic(name) && !compact(result).includes(compact(brand))) result = `${brand} ${result}`;
  if (quantity && !compact(result).includes(compact(quantity))) result = `${result} ${quantity}`;
  return result;
}
