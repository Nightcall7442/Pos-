import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportService } from "../services";
import LoadingSpinner from "../components/LoadingSpinner";
import { format, subDays } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, DollarSign, ShoppingCart, Users } from "lucide-react";
import { useMoney } from "../hooks/useMoney";

// Сталь, графит, светлая сталь, янтарь, коралл — палитра кассы, без синего шаблона.
const COLORS = ["#4f6a8a", "#2c3540", "#a2b3c7", "#b26a00", "#c8402b"];

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
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Отчёты</h1><p className="text-gray-500">Аналитика продаж</p></div>
        <div className="flex items-center gap-3">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input" />
          <span className="text-gray-400">—</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="card"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50"><DollarSign className="h-5 w-5 text-green-600" /></div><div><p className="text-sm text-gray-500">Выручка</p><p className="text-xl font-bold text-gray-900">{money(salesData?.totalRevenue || 0)}</p></div></div></div>
        <div className="card"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50"><ShoppingCart className="h-5 w-5 text-blue-600" /></div><div><p className="text-sm text-gray-500">Транзакции</p><p className="text-xl font-bold text-gray-900">{salesData?.totalTransactions || 0}</p></div></div></div>
        <div className="card"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-50"><TrendingUp className="h-5 w-5 text-yellow-600" /></div><div><p className="text-sm text-gray-500">Чаевые</p><p className="text-xl font-bold text-gray-900">{money(salesData?.totalTips || 0)}</p></div></div></div>
        <div className="card"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50"><Users className="h-5 w-5 text-purple-600" /></div><div><p className="text-sm text-gray-500">Средний чек</p><p className="text-xl font-bold text-gray-900">{money(salesData && salesData.totalTransactions > 0 ? salesData.totalRevenue / salesData.totalTransactions : 0)}</p></div></div></div>
      </div>

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
              <Pie data={salesData?.ordersByType || []} dataKey="_count" nameKey="type" cx="50%" cy="50%" outerRadius={100} label={({ type, _count }) => `${typeLabels[type] || type}: ${_count}`}>
                {(salesData?.ordersByType || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

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
