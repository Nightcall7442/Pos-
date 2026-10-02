import { describe, it, expect } from "vitest";
import { currencySymbol, formatMoney } from "./money";

// Те же суммы, что и в тестах кассы (pos-terminal/src/utils/money.test.ts):
// панель и касса должны показывать деньги одинаково. Пока money.ts у них
// разные копии (общий пакет — задача FE-2), это расхождение ловят тесты.
const SPACES = new RegExp("[" + String.fromCharCode(0xa0, 0x202f) + "]", "g");
const nb = (s: string) => s.replace(SPACES, " ");

describe("formatMoney in the panel", () => {
  it("matches the register for every currency", () => {
    expect(nb(formatMoney(1234567, "UZS"))).toBe("1 234 567 сўм");
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
    expect(nb(formatMoney(1234.5, "EUR"))).toBe("1.234,50 €");
    expect(nb(formatMoney(1234.5, "RUB"))).toBe("1 234,50 ₽");
    expect(nb(formatMoney(1234.5, "KZT"))).toBe("1 235 ₸");
  });

  it("treats bad amounts as zero", () => {
    expect(formatMoney(undefined, "USD")).toBe("$0.00");
    expect(currencySymbol("UZS")).toBe("сўм");
  });
});
