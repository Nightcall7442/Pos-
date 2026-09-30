import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, ShoppingCart, Package, Clock, TrendingUp, ScanBarcode } from "lucide-react";
import { useDashboard } from "../hooks/useReports";
import StatsCard from "../components/StatsCard";
import LoadingSpinner from "../components/LoadingSpinner";
import Badge, { statusBadge } from "../components/Badge";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useMoney } from "../hooks/useMoney";
import { settingsService } from "../services";

export default function Dashboard() {
  const { money } = useMoney();
  const { data: dashboard, isLoading } = useDashboard();
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: () => settingsService.get().then((r) => r.data.data), staleTime: 5 * 60 * 1000 });

  if (isLoading) return <LoadingSpinner />;

  const stats = dashboard || {
    todayOrders: 0,
    todayRevenue: 0,
    weekRevenue: 0,
    monthRevenue: 0,
    activeOrders: 0,
    totalProducts: 0,
    recentOrders: [],
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Дашборд</h1>
        <p className="text-gray-500 dark:text-gray-400">Добро пожаловать! Вот что происходит сегодня.</p>
      </div>

      {settings?.businessType === "retail" && stats.totalProducts === 0 && (
        <div className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Начните с товаров</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Наведите сканер на штрихкоды — название, объём и полка подставятся из общей базы, останется ввести цену. Каждый товар не нужно набирать руками.
            </p>
          </div>
          <Link to="/products/scan" className="btn-primary whitespace-nowrap">
            <ScanBarcode className="mr-2 h-4 w-4" />
            Добавить сканером
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Выручка за сегодня"
          value={money(stats.todayRevenue)}
          icon={<DollarSign className="h-6 w-6" />}
          color="green"
        />
        <StatsCard
          title="Заказов за сегодня"
          value={stats.todayOrders}
          icon={<ShoppingCart className="h-6 w-6" />}
          color="blue"
        />
        <StatsCard
          title="Активные заказы"
          value={stats.activeOrders}
          icon={<Clock className="h-6 w-6" />}
          color="yellow"
        />
        <StatsCard
          title="Всего товаров"
          value={stats.totalProducts}
          icon={<Package className="h-6 w-6" />}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">За неделю</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {money(stats.weekRevenue)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">За месяц</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {money(stats.monthRevenue)}
          </p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500 dark:text-green-400" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Средний чек</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {money(stats.todayOrders > 0 ? stats.todayRevenue / stats.todayOrders : 0)}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Последние заказы</h2>
          <a href="/orders" className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
            Все заказы
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <th className="pb-3 pr-4">Заказ №</th>
                <th className="pb-3 pr-4">Клиент</th>
                <th className="pb-3 pr-4">Позиции</th>
                <th className="pb-3 pr-4">Сумма</th>
                <th className="pb-3 pr-4">Статус</th>
                <th className="pb-3">Время</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {stats.recentOrders.map((order: any) => {
                const badge = statusBadge(order.status);
                return (
                  <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="whitespace-nowrap py-3 pr-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                      №{order.orderNumber}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-sm text-gray-600 dark:text-gray-400">
                      {order.customerName || "Гость"}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-sm text-gray-600 dark:text-gray-400">
                      {order.items?.length || 0} поз.
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {money(order.total)}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </td>
                    <td className="whitespace-nowrap py-3 text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(order.createdAt), "HH:mm", { locale: ru })}
                    </td>
                  </tr>
                );
              })}
              {(!stats.recentOrders || stats.recentOrders.length === 0) && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Заказов за сегодня пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
