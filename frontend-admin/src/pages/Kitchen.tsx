import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChefHat, Volume2, VolumeX } from "lucide-react";
import api from "../services/api";
import { useSocket } from "../services/socketService";
import toast from "react-hot-toast";
import type { ApiResponse, Order } from "../services";
import { apiErrorMessage } from "../utils/apiError";

/**
 * Экран кухни — тот же язык, что у кассы: графитовая строка состояния, колонки с
 * табличной шапкой, карточки на белом. Возраст заказа виден издалека: полоса слева
 * и таймер меняют цвет по ожиданию — до 5 минут спокойно, 5–10 внимание, дольше
 * горит. Цвета — через токены темы, поэтому экран работает и в тёмной теме.
 */

const COLUMNS = [
  { status: "pending", title: "Новые", action: "Принять", next: "confirmed" },
  { status: "confirmed", title: "Приняты", action: "Начать готовить", next: "preparing" },
  { status: "preparing", title: "Готовятся", action: "Готово", next: "ready" },
  { status: "ready", title: "Выдача", action: "Выдано", next: "served" },
] as const;

type Urgency = { bar: string; text: string; label: string };

// До 5 минут — спокойно, 5–10 — внимание, дольше — горит.
function urgency(minutes: number): Urgency {
  if (minutes >= 10) return { bar: "bg-red-500", text: "text-red-600", label: "горит" };
  if (minutes >= 5) return { bar: "bg-amber-500", text: "text-amber-600", label: "внимание" };
  return { bar: "bg-primary-500", text: "text-gray-900", label: "в норме" };
}

function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function place(order: Order): string {
  if (order.table) return `Стол ${order.table.number}`;
  if (order.type === "takeaway") return "Навынос";
  if (order.type === "dine_in") return "В зале";
  return order.type;
}

// Сигнал нового заказа. Функция модуля, а не компонента: эффект подписки на
// сокет вызывал её раньше, чем она была объявлена в теле компонента.
function playNotificationSound() {
  try {
    const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVggoKIaGBGP3+DhHJfRUJ/hYJyXkNBf4eCd2REQX6Hg3hlREB+iIN3ZkRAfoiDeGVEQH6Ig3hlREB+iIN4ZURAfoiDeGVEQH6Ig3hlREB+iIN4ZURAfo==");
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch {}
}

export default function Kitchen() {
  const queryClient = useQueryClient();
  const socket = useSocket();
  const [soundEnabled, setSoundEnabled] = useState(true);
  // Одно «сейчас» на весь экран: таймеры карточек идут посекундно и синхронно.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["kitchen-orders"],
    queryFn: () => api.get<ApiResponse<Order[]>>("/orders/active").then((r) => r.data.data),
    refetchInterval: 5000,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error, "Не удалось сменить статус заказа"));
    },
  });

  useEffect(() => {
    if (!socket) return;

    socket.on("order:created", (order) => {
      toast.success(`Новый заказ №${order.orderNumber}`);
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });

      if (soundEnabled) {
        playNotificationSound();
      }
    });

    socket.on("order:updated", () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
    });

    socket.on("order:cancelled", () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
    });

    return () => {
      socket.off("order:created");
      socket.off("order:updated");
      socket.off("order:cancelled");
    };
  }, [socket, queryClient, soundEnabled]);

  const active = (orders || []).filter((o) => COLUMNS.some((c) => c.status === o.status));
  const cooking = active.filter((o) => o.status !== "ready");
  // Часы планшета могут отставать от сервера — отрицательного ожидания не бывает.
  const avgMin = cooking.length
    ? Math.max(0, Math.round(cooking.reduce((sum, o) => sum + (now - new Date(o.createdAt).getTime()), 0) / cooking.length / 60000))
    : 0;

  return (
    <div className="overflow-hidden rounded-md border border-gray-200">
      <div className="flex min-h-12 flex-wrap items-center gap-x-5 gap-y-1 bg-bar px-4 py-2 text-sm text-bar-fg">
        <span className="flex items-center gap-2 font-semibold">
          <ChefHat className="h-5 w-5" aria-hidden />
          Кухня · экран раздачи
        </span>
        <span className="tabular-nums text-bar-muted">
          в работе {cooking.length} · среднее ожидание {avgMin} мин
        </span>
        <span className="ml-auto flex items-center gap-4">
          {[
            ["bg-primary-500", "до 5 мин"],
            ["bg-amber-500", "5–10"],
            ["bg-red-500", "10+"],
          ].map(([color, label]) => (
            <span key={label} className="hidden items-center gap-1.5 text-bar-muted sm:flex">
              <span className={`h-3 w-1 rounded-[1px] ${color}`} />
              {label}
            </span>
          ))}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-pressed={soundEnabled}
            className="flex h-9 items-center gap-2 rounded border border-white/15 px-3 transition-colors hover:border-white/40"
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {soundEnabled ? "Звук включён" : "Звук выключен"}
          </button>
        </span>
      </div>

      {isLoading ? (
        <div className="flex h-96 items-center justify-center bg-canvas">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600" />
        </div>
      ) : (
        <div className="grid gap-px bg-gray-200 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const list = active
              .filter((o) => o.status === col.status)
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            return (
              <section key={col.status} aria-label={col.title} className="flex min-h-[420px] min-w-0 flex-col bg-canvas">
                <div className="flex h-10 items-center justify-between bg-gray-100 px-4 text-[13px] font-semibold uppercase tracking-[0.04em] text-gray-600">
                  <span>{col.title}</span>
                  <span className="tabular-nums">{list.length}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2.5 p-2.5">
                  {list.length === 0 && <p className="py-8 text-center text-sm text-gray-500">Пусто</p>}
                  {list.map((order) => (
                    <Ticket
                      key={order.id}
                      order={order}
                      now={now}
                      ready={col.status === "ready"}
                      action={col.action}
                      busy={updateStatus.isPending && updateStatus.variables?.id === order.id}
                      onNext={() => updateStatus.mutate({ id: order.id, status: col.next })}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Ticket({
  order,
  now,
  ready,
  action,
  busy,
  onNext,
}: {
  order: Order;
  now: number;
  ready: boolean;
  action: string;
  busy: boolean;
  onNext: () => void;
}) {
  // На выдаче считаем, сколько готовый заказ ждёт официанта: с последней смены статуса.
  const since = new Date(ready && order.updatedAt ? order.updatedAt : order.createdAt).getTime();
  const seconds = (now - since) / 1000;
  const minutes = seconds / 60;
  // Готовое ждёт быстрее «горит»: 3 минуты — внимание, 5 — горит.
  const u = ready ? urgency(minutes >= 5 ? 10 : minutes >= 3 ? 5 : 0) : urgency(minutes);
  const full = ready ? 300 : 900;

  return (
    <article aria-label={`Заказ №${order.orderNumber}, ${place(order)}`} className="relative flex flex-col overflow-hidden rounded border border-gray-200 bg-surface">
      <span className={`absolute inset-y-0 left-0 w-1 ${u.bar}`} aria-hidden />
      <header className="flex items-start justify-between gap-2 px-4 pb-2 pt-3">
        <div className="flex flex-col">
          <span className="text-xl font-semibold leading-tight tabular-nums text-gray-900">№{order.orderNumber}</span>
          <span className="text-[13px] text-gray-500">{place(order)}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className={`text-[22px] font-semibold leading-tight tabular-nums ${u.text}`}>{mmss(seconds)}</span>
          <span className="text-xs text-gray-500">{ready ? "ждёт выдачи" : u.label}</span>
        </div>
      </header>
      <div className="mx-4 h-1 bg-gray-200" aria-hidden>
        <div className={`h-full ${u.bar}`} style={{ width: `${Math.min(1, seconds / full) * 100}%` }} />
      </div>
      <ul className="flex flex-col gap-1.5 px-4 py-3">
        {order.items?.map((item) => (
          <li key={item.id} className="flex flex-col">
            <span className="flex gap-2 text-base text-gray-900">
              <span className="w-8 shrink-0 font-semibold tabular-nums">{item.quantity} ×</span>
              <span className="min-w-0">{item.product?.name}</span>
            </span>
            {!!item.modifiers?.length && (
              <span className="ml-10 text-xs text-gray-500">
                {item.modifiers.map((m) => m.modifierItem?.name).filter(Boolean).join(", ")}
              </span>
            )}
            {item.notes && (
              // Заметка к блюду — плашкой, чтобы «без лука» не потерялось.
              <span className="ml-10 mt-0.5 w-fit rounded-sm bg-amber-500 px-1.5 py-0.5 text-xs font-semibold text-white">{item.notes}</span>
            )}
          </li>
        ))}
      </ul>
      {order.notes && <p className="mx-4 mb-3 rounded-sm bg-amber-50 px-2 py-1.5 text-sm text-amber-700">{order.notes}</p>}
      <button
        onClick={onNext}
        disabled={busy}
        className={`h-12 border-t border-gray-200 text-[15px] font-medium transition-colors disabled:opacity-50 ${
          ready ? "bg-action text-white hover:bg-action-hover" : "bg-bar-2 text-bar-fg hover:bg-bar-hover"
        }`}
      >
        {busy ? "Сохраняю…" : action}
      </button>
    </article>
  );
}
