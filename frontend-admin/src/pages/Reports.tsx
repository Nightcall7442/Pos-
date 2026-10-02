import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportService } from "../services";
import LoadingSpinner from "../components/LoadingSpinner";
import { format, subDays } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, DollarSign, ShoppingCart, Users, BarChart3 } from "lucide-react";
import EmptyState from "../components/EmptyState";
import { useMoney } from "../hooks/useMoney";

// Сталь, графит, светлая сталь, янтарь, коралл — палитра кассы. Токены темы, а не hex:
// в тёмной теме диаграмма перекрашивается вместе с панелью.
const COLORS = ["var(--steel-600)", "var(--gray-700)", "var(--steel-300)", "var(--amber-600)", "var(--red-600)"];

export default function Reports() {
  const { money } = useMoney();
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: salesData, isLoading } = useQuery({ queryKey: ["sales-report", dateFrom, dateTo], queryFn: () => reportService.getSales({ dateFrom, dateTo }).then((r) => r.data.data), enabled: !!dateFrom && !!dateTo });
  const { data: employeeData } = useQuery({ queryKey: ["employee-report", dateFrom, dateTo], queryFn: () => reportService.getEmployees({ dateFrom, dateTo }).then((r) => r.data.data), enabled: !!dateFrom && !!dateTo });

  if (isLoading) return <LoadingSpinner />;

  const typeLabels: Record<string, string> = { dine_in: "В зале", takeaway: "Навынос", delivery: "Доставка", online: "Онлайн" };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">Отчёты</h1><p className="text-gray-500">Аналитика продаж</p></div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <input type="date" aria-label="С даты" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input min-w-0 flex-1 sm:w-auto" />
          <span className="text-gray-400">—</span>
          <input type="date" aria-label="По дату" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input min-w-0 flex-1 sm:w-auto" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-50"><DollarSign className="h-5 w-5 text-primary-700" /></div><div><p className="text-sm text-gray-500">Выручка</p><p className="text-xl font-bold text-gray-900">{money(salesData?.totalRevenue || 0)}</p></div></div></div>
        <div className="card"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-50"><ShoppingCart className="h-5 w-5 text-primary-700" /></div><div><p className="text-sm text-gray-500">Транзакции</p><p className="text-xl font-bold text-gray-900">{salesData?.totalTransactions || 0}</p></div></div></div>
        <div className="card"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-50"><TrendingUp className="h-5 w-5 text-primary-700" /></div><div><p className="text-sm text-gray-500">Чаевые</p><p className="text-xl font-bold text-gray-900">{money(salesData?.totalTips || 0)}</p></div></div></div>
        <div className="card"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-50"><Users className="h-5 w-5 text-primary-700" /></div><div><p className="text-sm text-gray-500">Средний чек</p><p className="text-xl font-bold text-gray-900">{money(salesData && salesData.totalTransactions > 0 ? salesData.totalRevenue / salesData.totalTransactions : 0)}</p></div></div></div>
      </div>

      {!salesData?.totalTransactions ? (
        // Пустой период — одна фраза вместо двух пустых графиков (D-8).
        <div className="card">
          <EmptyState
            compact
            icon={<BarChart3 className="h-6 w-6" />}
            title="За эти даты продаж нет"
            description="Выберите другой период. Графики по часам и по типам заказов появятся с первым чеком за выбранные дни."
          />
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Продажи по часам</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={salesData?.salesByHour || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
              <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="revenue" fill="var(--steel-600)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Заказы по типу</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={salesData?.ordersByType || []} dataKey="_count" nameKey="type" cx="50%" cy="50%" outerRadius="70%" label={({ type, _count }) => `${typeLabels[type] || type}: ${_count}`}>
                {(salesData?.ordersByType || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      )}

      {employeeData && employeeData.length > 0 && (
        <div className="card">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Эффективность сотрудников</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead><tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="pb-3">Сотрудник</th><th className="pb-3">Роль</th><th className="pb-3 text-right">Заказов</th><th className="pb-3 text-right">Продажи</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {employeeData.map((emp) => (
                  <tr key={emp.id}>
                    <td className="py-3 font-medium text-gray-900">{emp.name}</td>
                    <td className="py-3 text-sm capitalize text-gray-500">{emp.role === "admin" ? "Администратор" : emp.role === "cashier" ? "Кассир" : emp.role}</td>
                    <td className="py-3 text-right text-sm text-gray-600">{emp.ordersCount}</td>
                    <td className="py-3 text-right font-medium text-gray-900">{money(emp.totalSales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
