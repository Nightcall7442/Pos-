import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Banknote, CreditCard, QrCode, ArrowRight, Smartphone } from "lucide-react";
import { useCartStore } from "../store/cartStore";
import api from "../services/api";
import toast from "react-hot-toast";
import type { Order, PaymentMethod, Product } from "../types";
import { useMoney } from "../hooks/useMoney";


interface PaymentModalProps {
  shiftId: string;
  onComplete: (order: Order) => void;
  onClose: () => void;
}

export default function PaymentModal({ shiftId, onComplete, onClose }: PaymentModalProps) {
  const { money, symbol, quickAmounts, compact } = useMoney();
  const qc = useQueryClient();
  const { items, getTotal, tableId, orderType, customerName, customerPhone, clearCart, repriceItems } = useCartStore();
  const [paidAmount, setPaidAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("cash");
  const [showQrSoon, setShowQrSoon] = useState(false);
  const [showCardSoon, setShowCardSoon] = useState(false);

  // One request: the server prices the cart, reserves stock, writes the payment
  // and completes the order atomically. `expectedTotal` is what the cashier
  // collected — if prices changed underneath, the server answers 409 and we
  // re-price the cart instead of recording an underpaid sale.
  const createOrder = useMutation({
    mutationFn: async (): Promise<Order> => {
      const res = await api.post("/orders/checkout", {
        type: orderType,
        tableId: tableId || undefined,
        cashShiftId: shiftId,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          grams: item.grams,
          modifierIds: item.modifiers?.map((m) => m.id) || [],
        })),
        expectedTotal: Math.round(getTotal() * 100) / 100,
        payment: { method: selectedMethod },
      });
      return res.data.data as Order;
    },
    onSuccess: (order) => {
      // Stock (and shift totals) changed server-side — refetch so the menu's
      // stock badges and totals reflect it right away.
      qc.invalidateQueries({ queryKey: ["products-all"] });
      qc.invalidateQueries({ queryKey: ["cash-shift"] });
      clearCart();
      onComplete(order);
      toast.success("Заказ завершён!");
    },
    onError: async (error: Error & { response?: { status?: number; data?: { error?: string; actualTotal?: number } } }) => {
      if (error.response?.status === 409) {
        try {
          const fresh = await api.get("/products", { params: { limit: 200, isActive: true } });
          repriceItems(fresh.data.data as Product[]);
        } catch {
          // fall through — the message below still tells the cashier to re-check
        }
        qc.invalidateQueries({ queryKey: ["products-all"] });
        toast.error(error.response.data?.error || "Цены изменились, проверьте корзину", { duration: 5000 });
        onClose();
        return;
      }
      toast.error(error.response?.data?.error || "Ошибка оплаты");
    },
  });

  const total = getTotal();
  const paid = paidAmount ? parseFloat(paidAmount) : total;
  const change = Math.max(0, paid - total);
  const canPay = true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ animation: "fade-in 0.2s ease" }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative mx-4 w-full max-w-lg rounded-3xl border border-dark-600 bg-dark-800 shadow-2xl overflow-hidden"
        style={{ animation: "scale-in 0.25s ease" }}
      >
        <div className="flex items-center justify-between border-b border-dark-700 px-6 py-4">
          <h2 className="text-lg font-bold text-dark-50">Оплата</h2>
          <button onClick={onClose} className="rounded-xl p-2 text-dark-400 hover:bg-dark-700 hover:text-dark-50 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 text-center">
          <p className="text-xs text-dark-400">К оплате</p>
          <p className="mt-1 text-5xl font-bold text-dark-50">{money(total)}</p>
          <p className="mt-1 text-xs text-dark-400">{items.length} поз.</p>
        </div>

        <div className="px-6 pb-4">
          <div className="grid grid-cols-3 gap-3">
            {([
              { key: "cash" as const, label: "Наличные", icon: Banknote, activeColor: "border-success-500 bg-success-500/10 shadow-success-500/10", textColor: "text-success-500" },
              { key: "card" as const, label: "Карта", icon: CreditCard, activeColor: "border-primary-500 bg-primary-600/10 shadow-primary-500/10", textColor: "text-primary-400" },
              { key: "qr" as const, label: "QR", icon: QrCode, activeColor: "border-primary-500 bg-primary-500/10 shadow-primary-500/10", textColor: "text-primary-400" },
            ]).map(({ key, label, icon: Icon, activeColor, textColor }) => (
              <button
                key={key}
                onClick={() => {
                  if (key === "qr") {
                    setShowQrSoon(true);
                    return;
                  }
                  if (key === "card") {
                    setShowCardSoon(true);
                    return;
                  }
                  setSelectedMethod(key);
                }}
                className={`flex flex-col items-center gap-2 rounded-2xl border-2 py-5 transition-all active:scale-[0.97] ${
                  selectedMethod === key
                    ? `${activeColor} shadow-md`
                    : "border-dark-600 bg-dark-700 hover:border-dark-500"
                }`}
              >
                <Icon className={`h-8 w-8 ${selectedMethod === key ? textColor : "text-dark-300"}`} />
                <span className={`text-sm font-semibold ${selectedMethod === key ? textColor : "text-dark-300"}`}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {selectedMethod === "cash" && (
          <div className="px-6 pb-4 space-y-3" style={{ animation: "slide-up 0.2s ease" }}>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-dark-400">Внесено</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-dark-400">{symbol}</span>
                <input
                  type="number"
                  step="1000"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border-2 border-dark-600 bg-dark-700 py-3.5 pl-14 pr-4 text-center text-2xl font-bold text-dark-50 placeholder:text-dark-500 focus:border-primary-500 focus:outline-none transition-colors"
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {/* The exact total plus a few denominations; the total may equal
                  one of them, so the index keeps the keys unique. */}
              {[total, ...quickAmounts.slice(0, 3)].map((amount, idx) => (
                <button
                  key={`${idx}-${amount}`}
                  onClick={() => setPaidAmount(String(amount))}
                  className="rounded-xl border border-dark-600 bg-dark-700 py-2 text-xs font-semibold text-dark-300 transition-all hover:border-primary-500/50 hover:text-dark-50 active:scale-95"
                >
                  {compact(amount)}
                </button>
              ))}
            </div>
            {change > 0 && (
              <div className="rounded-xl border border-success-500/30 bg-success-500/10 p-3 text-center" style={{ animation: "pop-in 0.2s ease" }}>
                <p className="text-[10px] font-medium text-success-500">Сдача</p>
                <p className="text-2xl font-bold text-success-500">{money(change)}</p>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-dark-700 px-6 py-4">
          <button
            onClick={() => createOrder.mutate()}
            disabled={createOrder.isPending || !canPay}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-success-600 py-4 text-base font-bold text-white shadow-lg shadow-success-600/30 transition-all hover:bg-success-500 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {createOrder.isPending ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Обработка...
              </>
            ) : (
              <>
                Оплатить — {money(total)}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* ═══ QR Coming Soon Modal ═══ */}
      {showQrSoon && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" style={{ animation: "fade-in 0.2s ease" }}>
          <div className="rounded-3xl border border-dark-600 bg-dark-800 p-8 w-80 text-center shadow-2xl" style={{ animation: "scale-in 0.2s ease" }}>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-500/15 mb-4">
              <Smartphone className="h-8 w-8 text-primary-400" />
            </div>
            <h3 className="text-lg font-bold text-dark-50">Скоро будет доступно</h3>
            <p className="mt-2 text-sm text-dark-400">QR-оплата находится в разработке</p>
            <button
              onClick={() => setShowQrSoon(false)}
              className="mt-6 w-full rounded-xl bg-primary-600 py-3 text-sm font-bold text-white hover:bg-primary-500 transition-colors active:scale-[0.98]"
            >
              Круто
            </button>
          </div>
        </div>
      )}

      {/* ═══ Card Coming Soon Modal ═══ */}
      {showCardSoon && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" style={{ animation: "fade-in 0.2s ease" }}>
          <div className="rounded-3xl border border-dark-600 bg-dark-800 p-8 w-80 text-center shadow-2xl" style={{ animation: "scale-in 0.2s ease" }}>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-500/15 mb-4">
              <CreditCard className="h-8 w-8 text-primary-400" />
            </div>
            <h3 className="text-lg font-bold text-dark-50">Скоро будет доступно</h3>
            <p className="mt-2 text-sm text-dark-400">Оплата картой находится в разработке</p>
            <button
              onClick={() => setShowCardSoon(false)}
              className="mt-6 w-full rounded-xl bg-primary-600 py-3 text-sm font-bold text-white hover:bg-primary-500 transition-colors active:scale-[0.98]"
            >
              Круто
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
