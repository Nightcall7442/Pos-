import { Link } from "react-router-dom";
import { DollarSign, ShoppingCart, Package, Clock, TrendingUp, ScanBarcode, Check, Plus } from "lucide-react";
import { useDashboard } from "../hooks/useReports";
import StatsCard from "../components/StatsCard";
import LoadingSpinner from "../components/LoadingSpinner";
import Badge, { statusBadge } from "../components/Badge";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useMoney } from "../hooks/useMoney";
import { useSettings } from "../hooks/useSettings";

export default function Dashboard() {
  const { money } = useMoney();
  const { data: dashboard, isLoading } = useDashboard();
  const { data: settings } = useSettings();

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

  const retail = settings?.businessType === "retail";
  const hasProducts = stats.totalProducts > 0;
  // Продажи были — точка работает; за месяц, чтобы шаги не возвращались после тихого дня.
  const hasSales = stats.todayOrders > 0 || stats.weekRevenue > 0 || stats.monthRevenue > 0 || (stats.recentOrders?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Дашборд</h1>
        <p className="text-gray-500">Добро пожаловать! Вот что происходит сегодня.</p>
      </div>

      {(!hasProducts || !hasSales) && (
        // Первый запуск (D-8): два шага до первой продажи, отметки ставятся сами.
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900">Первые шаги</h2>
          <p className="mt-1 text-sm text-gray-500">Два шага — и точка начнёт продавать.</p>
          <ol className="mt-4 divide-y divide-gray-100 border-y border-gray-100">
            <FirstStep
              n={1}
              done={hasProducts}
              title={retail ? "Заведите товары" : "Заведите меню"}
              text={
                retail
                  ? "Наведите сканер на штрихкод — название, объём и полка подставятся из общей базы, останется ввести цену."
                  : "Блюдо — это название, цена и категория. Категории станут клавишами на кассе, блюда — плитками."
              }
              action={
                retail ? (
                  <Link to="/products/scan" className="btn-primary whitespace-nowrap">
                    <ScanBarcode className="mr-2 h-4 w-4" />
                    Добавить сканером
                  </Link>
                ) : (
                  <Link to="/products/new" className="btn-primary whitespace-nowrap">
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить блюдо
                  </Link>
                )
              }
            />
            <FirstStep
              n={2}
              done={hasSales}
              title="Подключите кассу и пробейте первый чек"
              text={
                <>
                  Откройте кассу на планшете и введите код точки
                  {settings?.slug ? (
                    <code className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-900">{settings.slug}</code>
                  ) : (
                    " из «Настроек»"
                  )}
                  — кассиры входят по своему PIN.
                </>
              }
              action={
                <Link to="/users" className="btn-secondary whitespace-nowrap">
                  Сотрудники и PIN
                </Link>
              }
            />
          </ol>
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
          <p className="text-sm font-medium text-gray-500">За неделю</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {money(stats.weekRevenue)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-500">За месяц</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {money(stats.monthRevenue)}
          </p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-success-500" />
            <p className="text-sm font-medium text-gray-500">Средний чек</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {money(stats.todayOrders > 0 ? stats.todayRevenue / stats.todayOrders : 0)}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Последние заказы</h2>
          <Link to="/orders" className="text-sm font-medium text-primary-600 hover:text-primary-700">
            Все заказы
          </Link>
        </div>
        <ul className="divide-y divide-gray-100 sm:hidden">
          {stats.recentOrders.map((order) => {
            const badge = statusBadge(order.status);
            return (
              <li key={order.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    №{order.orderNumber} · {order.customerName || "Гость"}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    {order.items?.length || 0} поз. · {format(new Date(order.createdAt), "HH:mm", { locale: ru })}
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </p>
                </div>
                <span className="whitespace-nowrap text-sm font-semibold text-gray-900">{money(order.total)}</span>
              </li>
            );
          })}
          {(!stats.recentOrders || stats.recentOrders.length === 0) && <li className="py-8 text-center text-sm text-gray-500">Заказов за сегодня пока нет</li>}
        </ul>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="pb-3 pr-4">Заказ №</th>
                <th className="pb-3 pr-4">Клиент</th>
                <th className="pb-3 pr-4">Позиции</th>
                <th className="pb-3 pr-4">Сумма</th>
                <th className="pb-3 pr-4">Статус</th>
                <th className="pb-3">Время</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.recentOrders.map((order) => {
                const badge = statusBadge(order.status);
                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap py-3 pr-4 text-sm font-medium text-gray-900">
                      №{order.orderNumber}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-sm text-gray-600">
                      {order.customerName || "Гость"}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-sm text-gray-600">
                      {order.items?.length || 0} поз.
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-sm font-medium text-gray-900">
                      {money(order.total)}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </td>
                    <td className="whitespace-nowrap py-3 text-sm text-gray-500">
                      {format(new Date(order.createdAt), "HH:mm", { locale: ru })}
                    </td>
                  </tr>
                );
              })}
              {(!stats.recentOrders || stats.recentOrders.length === 0) && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-gray-500">
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

function FirstStep({ n, done, title, text, action }: { n: number; done: boolean; title: string; text: React.ReactNode; action: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          done ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600"
        }`}
        aria-hidden
      >
        {done ? <Check className="h-4 w-4" /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${done ? "text-gray-500 line-through" : "text-gray-900"}`}>
          {title}
          {done && <span className="sr-only"> — сделано</span>}
        </p>
        {!done && <p className="mt-0.5 text-sm text-gray-500">{text}</p>}
      </div>
      {!done && action}
    </li>
  );
}
