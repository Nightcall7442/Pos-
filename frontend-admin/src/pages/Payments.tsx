import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { paymentService } from "../services";
import Badge from "../components/Badge";
import LoadingSpinner from "../components/LoadingSpinner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CreditCard, Banknote } from "lucide-react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import Pagination from "../components/Pagination";
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

      {isLoading ? <LoadingSpinner /> : payments.length === 0 && page === 1 ? (
        <div className="card">
          <EmptyState
            compact
            icon={<CreditCard className="h-6 w-6" />}
            title="Оплат пока нет"
            description="Здесь будет каждая оплата с кассы — наличными, картой или по QR — с чеком и временем."
            action={<Link to="/settings" className="btn-primary">Код точки для кассы</Link>}
          />
        </div>
      ) : (
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
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {payment.method === "cash" ? <Banknote className="h-5 w-5 text-success-600" /> : <CreditCard className="h-5 w-5 text-info-600" />}
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
          {pagination && pagination.totalPages > 1 && (
            <div className="border-t border-gray-200 px-4 py-3">
              <Pagination page={page} totalPages={pagination.totalPages} total={pagination.total} onChange={setPage} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
