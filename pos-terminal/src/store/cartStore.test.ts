import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore } from "./cartStore";
import type { Product } from "../types";

// Корзина кассы — это деньги чека. Итог должен совпадать с тем, что посчитает
// сервер (он отклонит продажу, если разница больше копейки), а повторный скан и
// вес — складываться в одну строку, а не плодить новые.

const cart = () => useCartStore.getState();

const bread = { productId: "bread", name: "Хлеб «Нон»", price: 4500 };
const cheese = { productId: "cheese", name: "Сыр", rate: 98000, weightUnit: "кг" as const };

const product = (data: Partial<Product>): Product => ({ id: "x", name: "x", price: 0, ...data }) as Product;

beforeEach(() => {
  localStorage.clear();
  useCartStore.setState({ items: [], parked: [], tableId: undefined, orderType: "dine_in", customerName: undefined, customerPhone: undefined });
});

describe("pieces", () => {
  it("puts a repeated scan on the same line", () => {
    const first = cart().addPieces(bread, 1);
    const again = cart().addPieces(bread, 1);

    expect(again).toBe(first);
    expect(cart().items).toHaveLength(1);
    expect(cart().items[0].quantity).toBe(2);
  });

  it("adds a multiplier («5*код») as one step", () => {
    cart().addPieces(bread, 5);
    expect(cart().items[0].quantity).toBe(5);
    expect(cart().getTotal()).toBe(22500);
  });

  it("keeps different products on different lines", () => {
    cart().addPieces(bread, 1);
    cart().addPieces({ productId: "milk", name: "Молоко", price: 13500 }, 1);
    expect(cart().items).toHaveLength(2);
    expect(cart().getItemCount()).toBe(2);
  });

  it("removes a line when its quantity drops to zero", () => {
    const id = cart().addPieces(bread, 2);
    cart().updateQuantity(id, 0);
    expect(cart().items).toHaveLength(0);
  });
});

describe("weighed goods", () => {
  it("prices the weight from the rate per kilogram", () => {
    cart().addWeight(cheese, 250);
    expect(cart().items[0]).toMatchObject({ grams: 250, price: 24500 });
  });

  it("adds a second weighing to the line, or replaces it", () => {
    const id = cart().addWeight(cheese, 250);
    expect(cart().addWeight(cheese, 100)).toBe(id);
    expect(cart().items[0]).toMatchObject({ grams: 350, price: 34300 });

    cart().addWeight(cheese, 120, "set");
    expect(cart().items[0]).toMatchObject({ grams: 120, price: 11760 });
  });

  it("reprices the line when the weight is corrected", () => {
    const id = cart().addWeight(cheese, 250);
    cart().setWeight(id, 1000);
    expect(cart().items[0].price).toBe(98000);
  });

  it("keeps a weighed line apart from pieces of the same product", () => {
    cart().addWeight(cheese, 250);
    cart().addPieces({ productId: "cheese", name: "Сыр", price: 98000 }, 1);
    expect(cart().items).toHaveLength(2);
  });
});

describe("total", () => {
  // Сервер округляет каждую строку до копеек и складывает округлённое; касса —
  // так же, иначе итог расходится, и сервер отклоняет продажу.
  it("rounds each line before summing, as the server does", () => {
    cart().addItem({ productId: "a", name: "a", price: 0.105, quantity: 3 });
    cart().addItem({ productId: "b", name: "b", price: 0.105, quantity: 3 });
    // 0.315 → 0.32 на строку, 0.64 в сумме — а не 0.63 от округления суммы.
    expect(cart().getTotal()).toBe(0.64);
  });

  it("includes modifiers in the line price", () => {
    cart().addItem({ productId: "latte", name: "Латте", price: 20000, quantity: 2, modifiers: [{ id: "m", name: "Сироп", price: 3000 }] });
    expect(cart().getTotal()).toBe(46000);
  });
});

describe("parked checks", () => {
  it("sets a check aside and brings it back", () => {
    cart().addPieces(bread, 2);
    cart().setCustomer("Азиз", "+998901234567");

    expect(cart().parkCurrent()).toBe(true);
    expect(cart().items).toHaveLength(0);
    expect(cart().customerName).toBeUndefined();

    cart().restoreParked(cart().parked[0].id);
    expect(cart().items[0].quantity).toBe(2);
    expect(cart().customerName).toBe("Азиз");
    expect(cart().parked).toHaveLength(0);
  });

  it("parks the open check instead of losing it when another is restored", () => {
    cart().addPieces(bread, 1);
    cart().parkCurrent();
    const first = cart().parked[0].id;
    cart().addPieces({ productId: "milk", name: "Молоко", price: 13500 }, 3);

    cart().restoreParked(first);

    expect(cart().items[0].productId).toBe("bread");
    expect(cart().parked).toHaveLength(1);
    expect(cart().parked[0].items[0]).toMatchObject({ productId: "milk", quantity: 3 });
  });

  it("does not park an empty check", () => {
    expect(cart().parkCurrent()).toBe(false);
    expect(cart().parked).toHaveLength(0);
  });
});

describe("undo and repricing", () => {
  it("puts a removed line back where it was, once", () => {
    cart().addPieces(bread, 1);
    const milkId = cart().addPieces({ productId: "milk", name: "Молоко", price: 13500 }, 1);
    cart().addPieces({ productId: "tea", name: "Чай", price: 9000 }, 1);
    const removed = cart().items[1];
    cart().removeItem(milkId);

    cart().insertItem(removed, 1);
    cart().insertItem(removed, 1);

    expect(cart().items.map((i) => i.productId)).toEqual(["bread", "milk", "tea"]);
  });

  it("reprices from fresh server prices and says whether anything changed", () => {
    cart().addPieces(bread, 2);
    cart().addWeight(cheese, 500);

    expect(cart().repriceItems([product({ id: "bread", price: 4500 }), product({ id: "cheese", price: 98000, saleUnit: "кг" })])).toBe(false);

    expect(cart().repriceItems([product({ id: "bread", price: 5000 }), product({ id: "cheese", price: 100000, saleUnit: "кг" })])).toBe(true);
    expect(cart().items.find((i) => i.productId === "bread")?.price).toBe(5000);
    expect(cart().items.find((i) => i.productId === "cheese")).toMatchObject({ rate: 100000, price: 50000 });
  });

  // Порции в кафе (MenuScreen) предлагаются только товарам с ценой за грамм:
  // цена строки — цена грамма × граммы.
  it("reprices a café portion priced per gram", () => {
    cart().addItem({ productId: "plov", name: "Плов (300 г)", price: 45000, quantity: 1, grams: 300 });
    cart().repriceItems([product({ id: "plov", price: 160, saleUnit: "г" })]);
    expect(cart().items[0].price).toBe(48000);
  });
});

describe("order type", () => {
  it("drops the table when the order is no longer dine-in", () => {
    cart().setTable("table-1");
    cart().setOrderType("takeaway");
    expect(cart().tableId).toBeUndefined();
  });
});

describe("undo", () => {
  // «Очистить» на кассе — без подтверждения, но с «Вернуть»: всё ложится на место.
  it("restores lines, table and customer after a clear", () => {
    cart().addPieces(bread, 2);
    cart().setTable("table-3");
    cart().setCustomer("Азиза", "+998901234567");
    const { items, tableId, customerName, customerPhone } = cart();
    cart().clearCart();
    expect(cart().items).toHaveLength(0);
    cart().restoreCart({ items, tableId, customerName, customerPhone });
    expect(cart()).toMatchObject({ tableId: "table-3", customerName: "Азиза", customerPhone: "+998901234567" });
    expect(cart().items[0]).toMatchObject({ productId: "bread", quantity: 2 });
  });

  it("puts a removed line back in its place", () => {
    cart().addPieces(bread, 1);
    cart().addPieces({ productId: "milk", name: "Молоко", price: 13500 }, 1);
    const line = cart().items[0];
    cart().removeItem(line.id);
    cart().insertItem(line, 0);
    expect(cart().items.map((i) => i.productId)).toEqual(["bread", "milk"]);
  });
});
