import { describe, it, expect } from "vitest";
import { formatKg, kgToGrams, parseDecimal, pricePerKg, stockInKg, weightLineTotal, weightUnitOf } from "./weight";

// Весовой товар: в корзине — граммы, на экране — килограммы, цена — за грамм
// или за килограмм, как у товара. Ошибка здесь — тысячекратная ошибка в цене.

describe("weight unit", () => {
  it("recognises grams and kilograms in both spellings", () => {
    expect(weightUnitOf("кг")).toBe("кг");
    expect(weightUnitOf(" KG ")).toBe("кг");
    expect(weightUnitOf("г")).toBe("г");
    expect(weightUnitOf("g")).toBe("г");
    expect(weightUnitOf("шт")).toBeNull();
    expect(weightUnitOf(null)).toBeNull();
  });
});

describe("price of a weighing", () => {
  it("prices grams from a rate per kilogram", () => {
    expect(weightLineTotal(98000, 250, "кг")).toBe(24500);
    expect(weightLineTotal(98000, 1, "кг")).toBe(98);
  });

  it("prices grams from a rate per gram", () => {
    expect(weightLineTotal(160, 300, "г")).toBe(48000);
  });

  it("rounds to kopecks", () => {
    expect(weightLineTotal(12.99, 333, "кг")).toBe(4.33);
  });

  it("shows the shelf price per kilogram whatever the unit", () => {
    expect(pricePerKg(98000, "кг")).toBe(98000);
    expect(pricePerKg(160, "г")).toBe(160000);
  });
});

describe("what the cashier types and sees", () => {
  it("reads «0,5», «0.5» and «1 240»", () => {
    expect(parseDecimal("0,5")).toBe(0.5);
    expect(parseDecimal("0.5")).toBe(0.5);
    expect(parseDecimal("1 240")).toBe(1240);
    expect(parseDecimal("")).toBe(0);
    expect(parseDecimal("abc")).toBe(0);
  });

  it("turns typed kilograms into whole grams", () => {
    expect(kgToGrams(1.2345)).toBe(1235);
    expect(kgToGrams(0.1 + 0.2)).toBe(300);
  });

  it("shows weight like a scale does", () => {
    expect(formatKg(1240)).toBe("1,240");
    expect(formatKg(5)).toBe("0,005");
  });

  it("shows stock in kilograms", () => {
    expect(stockInKg(84.2, "кг")).toBe(84.2);
    expect(stockInKg(1500, "г")).toBe(1.5);
  });
});
