import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, OrderType, Product } from "../types";
import { round2 } from "../utils/money";
import { weightLineTotal, weightUnitOf } from "../utils/weight";
import { randomId } from "../utils/id";

// Что «Очистить» убирает из заказа — чтобы «Вернуть» положило всё на место.
export interface CartSnapshot {
  items: CartItem[];
  tableId?: string;
  customerName?: string;
  customerPhone?: string;
}

// A check the cashier set aside (the customer went back for one more thing):
// kept on this terminal until it is brought back or thrown away.
export interface ParkedCheck {
  id: string;
  createdAt: number;
  items: CartItem[];
  customerName?: string;
  customerPhone?: string;
}

export interface PieceInput {
  productId: string;
  name: string;
  price: number;
  barcode?: string | null;
  emoji?: string;
}

export interface WeightInput {
  productId: string;
  name: string;
  rate: number;
  weightUnit: "г" | "кг";
  barcode?: string | null;
  emoji?: string;
}

interface CartState {
  items: CartItem[];
  parked: ParkedCheck[];
  tableId?: string;
  orderType: OrderType;
  customerName?: string;
  customerPhone?: string;
  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  // Отмена «Очистить»: возвращает строки, стол и клиента.
  restoreCart: (snapshot: CartSnapshot) => void;
  setTable: (tableId?: string) => void;
  setOrderType: (type: OrderType) => void;
  setCustomer: (name?: string, phone?: string) => void;
  // ── shop register ──
  // Adds `qty` pieces of a product, merging into its line. Returns the line id.
  addPieces: (input: PieceInput, qty: number) => string;
  // Weighed product: adds to the line's weight ("add") or replaces it ("set").
  addWeight: (input: WeightInput, grams: number, mode?: "add" | "set") => string;
  setWeight: (id: string, grams: number) => void;
  // Puts a removed line back where it was (the "undo" after a mis-tap).
  insertItem: (item: CartItem, index: number) => void;
  parkCurrent: () => boolean;
  restoreParked: (id: string) => void;
  discardParked: (id: string) => void;
  // Re-price cart lines from fresh product data (after the server reports that
  // prices changed). Returns true when any line changed.
  repriceItems: (products: Product[]) => boolean;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      parked: [],
      orderType: "dine_in",
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find(
            (i) =>
              i.productId === item.productId &&
              i.grams === item.grams &&
              JSON.stringify(i.modifiers) === JSON.stringify(item.modifiers)
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === existing.id ? { ...i, quantity: i.quantity + item.quantity } : i
              ),
            };
          }
          return { items: [...state.items, { ...item, id: randomId() }] };
        }),
      removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      updateQuantity: (id, quantity) =>
        set((state) => ({
          items: quantity <= 0
            ? state.items.filter((i) => i.id !== id)
            : state.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
        })),
      clearCart: () => set({ items: [], tableId: undefined, customerName: undefined, customerPhone: undefined }),
      restoreCart: ({ items, tableId, customerName, customerPhone }) => set({ items, tableId, customerName, customerPhone }),
      setTable: (tableId) => set({ tableId }),
      // A table only makes sense for dine-in; drop it when switching away so a
      // takeaway order never carries a stale table.
      setOrderType: (orderType) => set(orderType === "dine_in" ? { orderType } : { orderType, tableId: undefined }),
      setCustomer: (name, phone) => set({ customerName: name, customerPhone: phone }),
      addPieces: (input, qty) => {
        const existing = get().items.find((i) => i.productId === input.productId && !i.grams && !i.modifiers?.length);
        if (existing) {
          set((state) => ({
            items: state.items.map((i) => (i.id === existing.id ? { ...i, quantity: i.quantity + qty } : i)),
          }));
          return existing.id;
        }
        const id = randomId();
        set((state) => ({ items: [...state.items, { ...input, id, quantity: qty }] }));
        return id;
      },
      addWeight: (input, grams, mode = "add") => {
        const { productId, rate, weightUnit, ...rest } = input;
        const existing = get().items.find((i) => i.productId === productId && i.grams);
        if (existing) {
          const total = mode === "add" ? (existing.grams ?? 0) + grams : grams;
          set((state) => ({
            items: state.items.map((i) =>
              i.id === existing.id ? { ...i, grams: total, rate, weightUnit, price: weightLineTotal(rate, total, weightUnit) } : i
            ),
          }));
          return existing.id;
        }
        const id = randomId();
        set((state) => ({
          items: [...state.items, { ...rest, id, productId, quantity: 1, grams, rate, weightUnit, price: weightLineTotal(rate, grams, weightUnit) }],
        }));
        return id;
      },
      setWeight: (id, grams) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id && i.rate !== undefined && i.weightUnit
              ? { ...i, grams, price: weightLineTotal(i.rate, grams, i.weightUnit) }
              : i
          ),
        })),
      insertItem: (item, index) =>
        set((state) => {
          if (state.items.some((i) => i.id === item.id)) return state;
          const items = state.items.slice();
          items.splice(Math.min(index, items.length), 0, item);
          return { items };
        }),
      parkCurrent: () => {
        const { items, customerName, customerPhone } = get();
        if (items.length === 0) return false;
        set((state) => ({
          parked: [...state.parked, { id: randomId(), createdAt: Date.now(), items, customerName, customerPhone }],
          items: [],
          customerName: undefined,
          customerPhone: undefined,
        }));
        return true;
      },
      restoreParked: (id) => {
        const target = get().parked.find((p) => p.id === id);
        if (!target) return;
        // Bringing one back while another check is open sets that one aside
        // instead of losing it.
        get().parkCurrent();
        set((state) => ({
          parked: state.parked.filter((p) => p.id !== id),
          items: target.items,
          customerName: target.customerName,
          customerPhone: target.customerPhone,
        }));
      },
      discardParked: (id) => set((state) => ({ parked: state.parked.filter((p) => p.id !== id) })),
      repriceItems: (products) => {
        let changed = false;
        const byId = new Map(products.map((p) => [p.id, p]));
        const items = get().items.map((item) => {
          const product = byId.get(item.productId);
          if (!product) return item;
          const unit = weightUnitOf(product.saleUnit);
          // Shop register weighed line: rate × grams, in the unit the product is priced in.
          if (item.grams && item.rate !== undefined && unit) {
            const price = weightLineTotal(Number(product.price), item.grams, unit);
            if (Math.abs(price - item.price) < 0.005 && item.rate === Number(product.price)) return item;
            changed = true;
            return { ...item, rate: Number(product.price), weightUnit: unit, price };
          }
          const price = item.grams ? Number(product.price) * item.grams : Number(product.price);
          if (Math.abs(price - item.price) < 0.005) return item;
          changed = true;
          return { ...item, price };
        });
        if (changed) set({ items });
        return changed;
      },
      getTotal: () => {
        const { items } = get();
        // Rounded per line, then summed — the same order the server prices in.
        return round2(
          items.reduce((sum, item) => {
            const modifiersTotal = item.modifiers?.reduce((s, m) => s + m.price, 0) || 0;
            return sum + round2((item.price + modifiersTotal) * item.quantity);
          }, 0)
        );
      },
      getItemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    { name: "pos-cart" }
  )
);
