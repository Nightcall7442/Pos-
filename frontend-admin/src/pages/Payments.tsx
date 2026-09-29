import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { paymentService } from "../services";
import Badge from "../components/Badge";
import LoadingSpinner from "../components/LoadingSpinner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { DollarSign, CreditCard, Banknote } from "lucide-react";
import { useMoney } from "../hooks/useMoney";

const methodLabels: Record<string, string> = { cash: "Наличные", card: "Карта", online: "Онлайн" };

export default function Payments() {
  const { money } = useMoney();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["payments", page],
    queryFn: () => paymentService.list({ page, limit: 20 }).then((r) => r.data),
  });

  const payments = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Оплаты</h1>
        <p className="text-gray-500">История всех платежей</p>
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="p-4">Способ</th>
                <th className="p-4">Заказ</th>
                <th className="p-4">Сумма</th>
                <th className="p-4">Чаевые</th>
                <th className="p-4">Статус</th>
                <th className="p-4">Дата</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((payment: any) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {payment.method === "cash" ? <Banknote className="h-5 w-5 text-green-600" /> : <CreditCard className="h-5 w-5 text-blue-600" />}
                      <span>{methodLabels[payment.method] || payment.method}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-gray-600">№{payment.order?.orderNumber}</td>
                  <td className="p-4 whitespace-nowrap font-medium text-gray-900">{money(payment.amount)}</td>
                  <td className="p-4 whitespace-nowrap text-sm text-gray-500">{Number(payment.tipAmount) > 0 ? money(payment.tipAmount) : "—"}</td>
                  <td className="p-4"><Badge variant={payment.status === "completed" ? "success" : payment.status === "refunded" ? "danger" : "warning"}>{payment.status === "completed" ? "Оплачено" : payment.status === "refunded" ? "Возврат" : payment.status}</Badge></td>
                  <td className="p-4 text-sm text-gray-500">{format(new Date(payment.createdAt), "d MMM HH:mm", { locale: ru })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagination && (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
              <p className="text-sm text-gray-500">Показано {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} из {pagination.total}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="btn-secondary text-xs py-1.5">Назад</button>
                <button onClick={() => setPage(page + 1)} disabled={page >= pagination.totalPages} className="btn-secondary text-xs py-1.5">Далее</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
