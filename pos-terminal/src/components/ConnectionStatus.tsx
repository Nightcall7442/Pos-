import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { checkConnection, useConnection } from "../services/connection";

// «0:42», «12:05», «1:03:20» — сколько уже нет связи.
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

/**
 * Полоса над экраном, пока нет связи (D-7). Офлайн-режима нет, поэтому главное —
 * сказать кассиру, что продажи сейчас не проходят и товар без чека отдавать
 * нельзя. floating — поверх экрана (вход, открытие смены), иначе в потоке,
 * чтобы не закрывать кнопки оплаты внизу.
 */
export function ConnectionBar({ floating = false }: { floating?: boolean }) {
  const { problem, since, checking } = useConnection();
  const now = useNow(problem !== null);
  if (!problem) return null;

  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 bg-danger-600 px-4 py-1.5 text-white ${
        floating ? "fixed inset-x-0 top-0 z-[60]" : "shrink-0"
      }`}
    >
      <WifiOff className="h-5 w-5 shrink-0" aria-hidden />
      <span className="text-sm font-semibold">
        {problem === "device" ? "Нет интернета на планшете" : "Нет связи с сервером"}
        {since !== null && <span className="ml-2 font-normal opacity-80">{formatElapsed(now - since)}</span>}
      </span>
      <span className="min-w-0 flex-1 text-sm opacity-90">
        Продажи не проходят — не отдавайте товар, пока чек не пробит.
        {problem === "device" && " Проверьте Wi-Fi."}
      </span>
      <button
        type="button"
        onClick={() => void checkConnection()}
        disabled={checking}
        className="-my-1.5 min-h-11 rounded border border-white/50 px-4 text-sm font-medium hover:bg-white/10 disabled:opacity-60"
      >
        {checking ? "Проверяю…" : "Проверить"}
      </button>
    </div>
  );
}

/** Постоянная метка в верхней строке: «Связь» или «Нет связи». */
export function ConnectionDot() {
  const problem = useConnection((s) => s.problem);
  if (problem) {
    return (
      <span className="pos-net is-down" role="status">
        <span className="pos-net-dot" aria-hidden />
        Нет связи
      </span>
    );
  }
  return (
    <span className="pos-net" title="Связь с сервером есть">
      <span className="pos-net-dot" aria-hidden />
      Связь
    </span>
  );
}
