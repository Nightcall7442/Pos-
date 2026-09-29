import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Check, ChefHat, Bell, Volume2 } from "lucide-react";
import api from "../services/api";
import { useSocket } from "../services/socketService";
import toast from "react-hot-toast";

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Новый", color: "text-yellow-700", bg: "bg-yellow-100 border-yellow-300" },
  confirmed: { label: "Подтверждён", color: "text-blue-700", bg: "bg-blue-100 border-blue-300" },
  preparing: { label: "Готовится", color: "text-orange-700", bg: "bg-orange-100 border-orange-300" },
  ready: { label: "Готов", color: "text-green-700", bg: "bg-green-100 border-green-300" },
};

export default function Kitchen() {
  const queryClient = useQueryClient();
  const socket = useSocket();
  const [soundEnabled, setSoundEnabled] = useState(true);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["kitchen-orders"],
    queryFn: () => api.get("/orders/active").then((r) => r.data.data),
    refetchInterval: 5000,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
    },
  });

  useEffect(() => {
    if (!socket) return;

    socket.on("order:created", (order: any) => {
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

  const playNotificationSound = () => {
    try {
      const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVggoKIaGBGP3+DhHJfRUJ/hYJyXkNBf4eCd2REQX6Hg3hlREB+iIN3ZkRAfoiDeGVEQH6Ig3hlREB+iIN4ZURAfoiDeGVEQH6Ig3hlREB+iIN4ZURAfo==");
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {}
  };

  const getNextStatus = (currentStatus: string): string | null => {
    const flow: Record<string, string> = {
      pending: "confirmed",
      confirmed: "preparing",
      preparing: "ready",
    };
    return flow[currentStatus] || null;
  };

  const getNextStatusLabel = (currentStatus: string): string => {
    const labels: Record<string, string> = {
      pending: "Принять",
      confirmed: "Начать готовить",
      preparing: "Готово",
    };
    return labels[currentStatus] || "";
  };

  const activeOrders = (orders || []).filter((o: any) =>
    ["pending", "confirmed", "preparing", "ready"].includes(o.status)
  );

  const groupedOrders = {
    pending: activeOrders.filter((o: any) => o.status === "pending"),
    confirmed: activeOrders.filter((o: any) => o.status === "confirmed"),
    preparing: activeOrders.filter((o: any) => o.status === "preparing"),
    ready: activeOrders.filter((o: any) => o.status === "ready"),
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-600 border-t-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-700 bg-gray-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <ChefHat className="h-8 w-8 text-orange-400" />
          <h1 className="text-2xl font-bold">Кухонный дисплей</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            Активных заказов: {activeOrders.length}
          </span>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`rounded-lg p-2 transition-colors ${
              soundEnabled ? "bg-green-600 text-white" : "bg-gray-700 text-gray-400"
            }`}
          >
            {soundEnabled ? <Volume2 className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-yellow-400" />
            <h2 className="font-semibold text-yellow-400">
              Новые ({groupedOrders.pending.length})
            </h2>
          </div>
          <div className="space-y-4">
            {groupedOrders.pending.map((order: any) => (
              <OrderCard
                key={order.id}
                order={order}
                onNext={() => updateStatus.mutate({ id: order.id, status: "confirmed" })}
                nextLabel="Принять"
                isUpdating={updateStatus.isPending}
              />
            ))}
            {groupedOrders.pending.length === 0 && (
              <p className="text-center text-sm text-gray-500">Нет новых заказов</p>
            )}
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-blue-400" />
            <h2 className="font-semibold text-blue-400">
              Подтверждены ({groupedOrders.confirmed.length})
            </h2>
          </div>
          <div className="space-y-4">
            {groupedOrders.confirmed.map((order: any) => (
              <OrderCard
                key={order.id}
                order={order}
                onNext={() => updateStatus.mutate({ id: order.id, status: "preparing" })}
                nextLabel="Начать готовить"
                isUpdating={updateStatus.isPending}
              />
            ))}
            {groupedOrders.confirmed.length === 0 && (
              <p className="text-center text-sm text-gray-500">Нет заказов</p>
            )}
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-orange-400 animate-pulse" />
            <h2 className="font-semibold text-orange-400">
              Готовятся ({groupedOrders.preparing.length})
            </h2>
          </div>
          <div className="space-y-4">
            {groupedOrders.preparing.map((order: any) => (
              <OrderCard
                key={order.id}
                order={order}
                onNext={() => updateStatus.mutate({ id: order.id, status: "ready" })}
                nextLabel="Готово"
                isUpdating={updateStatus.isPending}
              />
            ))}
            {groupedOrders.preparing.length === 0 && (
              <p className="text-center text-sm text-gray-500">Нет заказов</p>
            )}
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-400" />
            <h2 className="font-semibold text-green-400">
              Готовы ({groupedOrders.ready.length})
            </h2>
          </div>
          <div className="space-y-4">
            {groupedOrders.ready.map((order: any) => (
              <OrderCard
                key={order.id}
                order={order}
                onNext={() => updateStatus.mutate({ id: order.id, status: "served" })}
                nextLabel="Подан"
                isUpdating={updateStatus.isPending}
                isReady
              />
            ))}
            {groupedOrders.ready.length === 0 && (
              <p className="text-center text-sm text-gray-500">Нет заказов</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderCard({
  order,
  onNext,
  nextLabel,
  isUpdating,
  isReady,
}: {
  order: any;
  onNext: () => void;
  nextLabel: string;
  isUpdating: boolean;
  isReady?: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(order.createdAt).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000 / 60));
    }, 10000);
    setElapsed(Math.floor((Date.now() - start) / 1000 / 60));
    return () => clearInterval(interval);
  }, [order.createdAt]);

  const status = statusConfig[order.status] || statusConfig.pending;

  return (
    <div
      className={`rounded-xl border-2 bg-gray-800 p-4 transition-all ${
        isReady ? "border-green-500 animate-pulse" : status.bg.replace("bg-", "border-").replace("-100", "-500")
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold">#{order.orderNumber}</span>
          {order.table && (
            <span className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300">
              Стол {order.table.number}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-gray-400">
          <Clock className="h-4 w-4" />
          <span className="text-sm">{elapsed} мин</span>
        </div>
      </div>

      <div className="mb-3">
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
          order.type === "dine_in" ? "bg-blue-900 text-blue-200" :
          order.type === "takeaway" ? "bg-purple-900 text-purple-200" :
          "bg-gray-700 text-gray-300"
        }`}>
          {order.type === "dine_in" ? "В зале" : order.type === "takeaway" ? "Навынос" : order.type}
        </span>
      </div>

      <div className="mb-4 space-y-2">
        {order.items?.map((item: any) => (
          <div key={item.id} className="flex items-start justify-between">
            <div>
              <span className="font-medium text-white">
                {item.quantity}x {item.product?.name}
              </span>
              {item.modifiers?.length > 0 && (
                <div className="ml-4 text-xs text-gray-400">
                  {item.modifiers.map((m: any) => m.modifierItem?.name).filter(Boolean).join(", ")}
                </div>
              )}
              {item.notes && (
                <div className="ml-4 text-xs text-yellow-400">{item.notes}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {order.notes && (
        <div className="mb-3 rounded-lg bg-yellow-900/30 p-2 text-sm text-yellow-300">
          {order.notes}
        </div>
      )}

      <button
        onClick={onNext}
        disabled={isUpdating}
        className={`w-full rounded-lg py-3 font-semibold transition-all active:scale-95 disabled:opacity-50 ${
          isReady
            ? "bg-green-600 text-white hover:bg-green-700"
            : "bg-white text-gray-900 hover:bg-gray-100"
        }`}
      >
        {isUpdating ? (
          <div className="flex items-center justify-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ...
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <Check className="h-5 w-5" />
            {nextLabel}
          </div>
        )}
      </button>
    </div>
  );
}
