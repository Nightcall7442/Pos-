import { describe, it, expect } from "vitest";
import { formatQty, shelfPrice, stockLabel, stockLeft, stockState } from "./shopProduct";
import type { CartItem, Product } from "../../types";

// Остаток на полке с учётом того, что уже лежит в чеке: касса не даёт
// пробить больше, чем есть, ещё до того, как это отклонит сервер.

const product = (data: Partial<Product>): Product =>
  ({ id: "p", name: "Товар", price: 10, currentStock: 10, minStock: 0, trackInventory: true, ...data }) as Product;
const line = (data: Partial<CartItem>): CartItem => ({ id: "l", productId: "p", name: "Товар", price: 10, quantity: 1, ...data });

describe("stock left on the shelf", () => {
  it("subtracts pieces already in the check", () => {
    expect(stockLeft(product({ currentStock: 10 }), [line({ quantity: 3 }), line({ id: "l2", quantity: 2 })])).toBe(5);
  });

  it("subtracts grams in the product's own unit", () => {
    const cheese = product({ currentStock: 2, saleUnit: "кг" });
    expect(stockLeft(cheese, [line({ grams: 250 })])).toBeCloseTo(1.75, 9);

    const spice = product({ currentStock: 1000, saleUnit: "г" });
    expect(stockLeft(spice, [line({ grams: 250, quantity: 2 })])).toBe(500);
  });

  it("leaves out the line being edited", () => {
    expect(stockLeft(product({ currentStock: 10 }), [line({ id: "edit", quantity: 4 })], "edit")).toBe(10);
  });

  it("is unlimited when stock is not tracked", () => {
    expect(stockLeft(product({ trackInventory: false }), [line({ quantity: 99 })])).toBe(Infinity);
  });

  it("ignores other products", () => {
    expect(stockLeft(product({ currentStock: 10 }), [line({ productId: "other", quantity: 9 })])).toBe(10);
  });
});

describe("tile labels", () => {
  it("marks out of stock and low stock", () => {
    expect(stockState(product({ currentStock: 0 }))).toBe("out");
    expect(stockState(product({ currentStock: 3, minStock: 5 }))).toBe("low");
    expect(stockState(product({ currentStock: 6, minStock: 5 }))).toBe("ok");
    expect(stockState(product({ currentStock: 0, trackInventory: false }))).toBe("ok");
  });

  it("shows weighed stock in kilograms and pieces as a number", () => {
    expect(stockLabel(product({ currentStock: 84.24, saleUnit: "кг" }))).toBe("84,2 кг");
    expect(stockLabel(product({ currentStock: 1500, saleUnit: "г" }))).toBe("1,5 кг");
    expect(stockLabel(product({ currentStock: 24 }))).toBe("24");
    expect(stockLabel(product({ trackInventory: false }))).toBeNull();
  });

  it("shows the shelf price per kilogram for weighed goods", () => {
    expect(shelfPrice(product({ price: 160, saleUnit: "г" }))).toEqual({ amount: 160000, per: "кг" });
    expect(shelfPrice(product({ price: 4500 }))).toEqual({ amount: 4500, per: "" });
  });

  it("formats quantities with one decimal at most", () => {
    expect(formatQty(12)).toBe("12");
    expect(formatQty(84.25)).toBe("84,3");
  });
});
