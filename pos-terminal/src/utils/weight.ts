import { round2 } from "./money";

// Weighted goods are priced per gram ("г") or per kilogram ("кг") — the same
// two units the server understands (stock.helpers.gramsPerUnit). The cart always
// carries the weight in grams; the cashier always thinks in kilograms.

export type WeightUnit = "г" | "кг";

export function weightUnitOf(saleUnit?: string | null): WeightUnit | null {
  switch ((saleUnit || "").trim().toLowerCase()) {
    case "г":
    case "g":
      return "г";
    case "кг":
    case "kg":
      return "кг";
    default:
      return null;
  }
}

export const gramsPerUnit = (unit: WeightUnit): number => (unit === "кг" ? 1000 : 1);

/** Price of `grams` of a product priced `rate` per `unit` — as the server computes it. */
export function weightLineTotal(rate: number, grams: number, unit: WeightUnit): number {
  return round2((rate * grams) / gramsPerUnit(unit));
}

/** Shelf price is always shown per kilogram, whichever unit the product is kept in. */
export function pricePerKg(rate: number, unit: WeightUnit): number {
  return unit === "кг" ? rate : rate * 1000;
}

/** Stock is kept in the product's own unit; the screen shows kilograms. */
export function stockInKg(stock: number, unit: WeightUnit): number {
  return unit === "кг" ? stock : stock / 1000;
}

/** 1240 → "1,240": three decimals, comma — the way a scale shows it. */
export function formatKg(grams: number): string {
  return (grams / 1000).toFixed(3).replace(".", ",");
}

/** "0,5" / "0.5" / "1 240" → 0.5 / 0.5 / 1240; empty or garbage → 0. */
export function parseDecimal(text: string): number {
  const n = Number(text.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Kilograms typed on the keypad → whole grams. */
export function kgToGrams(kg: number): number {
  return Math.round(kg * 1000);
}
