import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cashShiftService } from "../services";
import LoadingSpinner from "../components/LoadingSpinner";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { User, Clock, Eye } from "lucide-react";
import { useMoney } from "../hooks/useMoney";


interface CashShift {
  id: string;
  status: string;
  openingCash: number;
  closingCash: number | null;
  totalSales: number;
  totalCashSales: number;
  totalCardSales: number;
  totalQrSales: number;
  totalTips: number;
  totalRefunds: number;
  expectedCash: number | null;
  difference: number | null;
  notes: string | null;
  openedAt: string;
  closedAt: string | null;
  user: { firstName: string; lastName: string };
  _count?: { orders: number };
}

export default function CashShifts() {
  const { money } = useMoney();
  const [showDetail, setShowDetail] = useState<CashShift | null>(null);

  const { data: shiftsData, isLoading } = useQuery({
    queryKey: ["cash-shifts"],
    queryFn: () => cashShiftService.list({ limit: 50 }).then((r) => r.data),
  });

  const shifts: CashShift[] = shiftsData?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Кассовые смены</h1>
        <p className="text-gray-500">История рабочих смен</p>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="p-4">Статус</th>
                <th className="p-4">Сотрудник</th>
                <th className="p-4">Открыта</th>
                <th className="p-4">Закрыта</th>
                <th className="p-4 text-right">Продажи</th>
                <th className="p-4 text-right">Наличные</th>
                <th className="p-4 text-right">Разница</th>
                <th className="p-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shifts.map((shift) => (
                <tr key={shift.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <Badge variant={shift.status === "open" ? "success" : "gray"}>
                      {shift.status === "open" ? "Открыта" : "Закрыта"}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-gray-400" />
                      {shift.user.firstName} {shift.user.lastName}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="h-4 w-4" />
                      {new Date(shift.openedAt).toLocaleString("ru-RU")}
                    </div>
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    {shift.closedAt ? new Date(shift.closedAt).toLocaleString("ru-RU") : "—"}
                  </td>
                  <td className="p-4 whitespace-nowrap text-right font-medium text-gray-900">{money(shift.totalSales)}</td>
                  <td className="p-4 whitespace-nowrap text-right text-sm text-gray-500">{money(shift.totalCashSales)}</td>
                  <td className="p-4 text-right">
                    {shift.difference !== null ? (
                      <span className={`text-sm font-medium ${shift.difference === 0 ? "text-green-600" : "text-red-600"}`}>
                        {shift.difference === 0 ? "Сходится" : money(shift.difference)}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => setShowDetail(shift)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {shifts.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    Нет смен
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title="Детали смены" size="lg">
        {showDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Сотрудник:</span> <span className="font-medium">{showDetail.user.firstName} {showDetail.user.lastName}</span></div>
              <div><span className="text-gray-500">Статус:</span> <Badge variant={showDetail.status === "open" ? "success" : "gray"}>{showDetail.status === "open" ? "Открыта" : "Закрыта"}</Badge></div>
              <div><span className="text-gray-500">Открыта:</span> <span className="font-medium">{new Date(showDetail.openedAt).toLocaleString("ru-RU")}</span></div>
              <div><span className="text-gray-500">Закрыта:</span> <span className="font-medium">{showDetail.closedAt ? new Date(showDetail.closedAt).toLocaleString("ru-RU") : "—"}</span></div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Итоги</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Начальная сумма</p>
                  <p className="text-lg font-bold text-gray-900">{money(showDetail.openingCash)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Конечная сумма</p>
                  <p className="text-lg font-bold text-gray-900">{showDetail.closingCash !== null ? money(showDetail.closingCash) : "—"}</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="text-xs text-blue-600">Продажи наличными</p>
                  <p className="text-lg font-bold text-blue-700">{money(showDetail.totalCashSales)}</p>
                </div>
                <div className="rounded-lg bg-purple-50 p-3">
                  <p className="text-xs text-purple-600">Продажи картой</p>
                  <p className="text-lg font-bold text-purple-700">{money(showDetail.totalCardSales)}</p>
                </div>
                <div className="rounded-lg bg-green-50 p-3">
                  <p className="text-xs text-green-600">Общая сумма</p>
                  <p className="text-lg font-bold text-green-700">{money(showDetail.totalSales)}</p>
                </div>
                <div className="rounded-lg bg-yellow-50 p-3">
                  <p className="text-xs text-yellow-600">Чаевые</p>
                  <p className="text-lg font-bold text-yellow-700">{money(showDetail.totalTips)}</p>
                </div>
              </div>
            </div>

            {showDetail.difference !== null && showDetail.difference !== 0 && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-700">
                  <strong>Расхождение:</strong> {money(showDetail.difference)}
                </p>
              </div>
            )}

            {showDetail.notes && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Примечание</h4>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{showDetail.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
