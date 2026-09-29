import { useState } from "react";
import { Link } from "react-router-dom";
import { useOrders, useUpdateOrderStatus, useCancelOrder } from "../hooks/useOrders";
import Badge, { statusBadge } from "../components/Badge";
import LoadingSpinner from "../components/LoadingSpinner";
import EmptyState from "../components/EmptyState";
import SearchInput from "../components/SearchInput";
import Modal from "../components/Modal";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ShoppingCart, Eye } from "lucide-react";
import { useMoney } from "../hooks/useMoney";

const statusTabs = [
  { value: "", label: "Все заказы" },
  { value: "pending", label: "Ожидают" },
  { value: "confirmed", label: "Подтверждены" },
  { value: "preparing", label: "Готовятся" },
  { value: "ready", label: "Готовы" },
  { value: "completed", label: "Завершены" },
  { value: "cancelled", label: "Отменены" },
];

const statusFlow: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready"],
  ready: ["served"],
  served: ["completed"],
};

const statusLabels: Record<string, string> = {
  pending: "Ожидает",
  confirmed: "Подтверждён",
  preparing: "Готовится",
  ready: "Готов",
  served: "Подан",
  completed: "Завершён",
  cancelled: "Отменён",
};

export default function Orders() {
  const { money } = useMoney();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);

  const { data, isLoading } = useOrders({ status: status || undefined, search, limit: 50 });
  const updateStatus = useUpdateOrderStatus();
  const cancelOrder = useCancelOrder();

  const orders = data?.data || [];

  const handleStatusChange = (orderId: string, newStatus: string) => {
    updateStatus.mutate({ id: orderId, status: newStatus });
  };

  const handleCancel = () => {
    if (cancelId) {
      cancelOrder.mutate(cancelId, { onSuccess: () => setCancelId(null) });
    }
  };

  const nextStatusLabels: Record<string, string> = {
    confirmed: "Подтвердить",
    preparing: "Готовить",
    ready: "Готово",
    served: "Подан",
    completed: "Завершить",
    cancelled: "Отменить",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Заказы</h1>
          <p className="text-gray-500">Управление и отслеживание заказов</p>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 pb-px">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={`whitespace-nowrap rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              status === tab.value ? "border-b-2 border-primary-600 text-primary-600" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="Поиск заказов..." className="w-80" />

      {isLoading ? (
        <LoadingSpinner />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="h-8 w-8" />}
          title="Заказов не найдено"
          description="Заказы появятся здесь по мере поступления"
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order: any) => {
            const badge = statusBadge(order.status);
            const nextStatuses = statusFlow[order.status] || [];
            return (
              <div key={order.id} className="card flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-lg font-bold text-primary-700">
                    №{order.orderNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{order.customerName || "Гость"}</span>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      <Badge variant="gray">{order.type === "dine_in" ? "Зал" : order.type === "takeaway" ? "Навынос" : order.type}</Badge>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-sm text-gray-500">
                      <span>{order.items?.length || 0} поз.</span>
                      <span>·</span>
                      <span className="font-medium text-gray-900">{money(order.total)}</span>
                      {order.table && (<><span>·</span><span>Стол {order.table.number}</span></>)}
                      <span>·</span>
                      <span>{format(new Date(order.createdAt), "HH:mm", { locale: ru })}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {nextStatuses.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(order.id, s)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        s === "cancelled" ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-primary-50 text-primary-700 hover:bg-primary-100"
                      }`}
                    >
                      {nextStatusLabels[s] || s}
                    </button>
                  ))}
                  <Link to={`/orders/${order.id}`} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                    <Eye className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={!!cancelId} onClose={() => setCancelId(null)} title="Отмена заказа" size="sm">
        <p className="text-gray-600">Вы уверены, что хотите отменить этот заказ?</p>
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={() => setCancelId(null)} className="btn-secondary">Нет</button>
          <button onClick={handleCancel} className="btn-danger">Да, отменить</button>
        </div>
      </Modal>
    </div>
  );
}
