import { beforeEach, describe, expect, it } from "vitest";
import { checkoutKeyFor, forgetCheckoutKey } from "./checkoutKey";

const sale = { cashShiftId: "shift-1", items: [{ productId: "p1", quantity: 2 }] };

describe("ключ продажи", () => {
  beforeEach(() => localStorage.clear());

  it("повтор той же продажи идёт с тем же ключом — второй чек не создастся", () => {
    const first = checkoutKeyFor(sale);
    expect(first).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
    expect(checkoutKeyFor({ ...sale, items: [{ productId: "p1", quantity: 2 }] })).toBe(first);
  });

  it("другой состав или другая смена — новая продажа и новый ключ", () => {
    const first = checkoutKeyFor(sale);
    expect(checkoutKeyFor({ ...sale, items: [{ productId: "p1", quantity: 3 }] })).not.toBe(first);
    const second = checkoutKeyFor(sale);
    expect(checkoutKeyFor({ ...sale, cashShiftId: "shift-2" })).not.toBe(second);
  });

  it("после успешной оплаты ключ забывается: такая же продажа следом — новая", () => {
    const first = checkoutKeyFor(sale);
    forgetCheckoutKey();
    expect(checkoutKeyFor(sale)).not.toBe(first);
  });

  it("переживает перезагрузку страницы, но не дольше 12 часов", () => {
    const now = 1_000_000;
    const first = checkoutKeyFor(sale, now);
    expect(JSON.parse(localStorage.getItem("pos-checkout-key")!).key).toBe(first);
    expect(checkoutKeyFor(sale, now + 11 * 3600_000)).toBe(first);
    expect(checkoutKeyFor(sale, now + 13 * 3600_000)).not.toBe(first);
  });
});
