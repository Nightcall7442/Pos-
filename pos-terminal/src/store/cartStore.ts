import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, OrderType, Product } from "../types";

function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

interface CartState {
  items: CartItem[];
  tableId?: string;
  orderType: OrderType;
  customerName?: string;
  customerPhone?: string;
  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  setTable: (tableId?: string) => void;
  setOrderType: (type: OrderType) => void;
  setCustomer: (name?: string, phone?: string) => void;
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
      setTable: (tableId) => set({ tableId }),
      // A table only makes sense for dine-in; drop it when switching away so a
      // takeaway order never carries a stale table.
      setOrderType: (orderType) => set(orderType === "dine_in" ? { orderType } : { orderType, tableId: undefined }),
      setCustomer: (name, phone) => set({ customerName: name, customerPhone: phone }),
      repriceItems: (products) => {
        let changed = false;
        const byId = new Map(products.map((p) => [p.id, p]));
        const items = get().items.map((item) => {
          const product = byId.get(item.productId);
          if (!product) return item;
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
        return items.reduce((sum, item) => {
          const modifiersTotal = item.modifiers?.reduce((s, m) => s + m.price, 0) || 0;
          return sum + (item.price + modifiersTotal) * item.quantity;
        }, 0);
      },
      getItemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    { name: "pos-cart" }
  )
);
