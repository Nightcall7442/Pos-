import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  Settings,
  Tags,
  Warehouse,
  Grid3X3,
  CreditCard,
  ChevronLeft,
  Store,
  FileText,
  Clock,
  ChefHat,
  Utensils,
} from "lucide-react";
import { useUIStore } from "../store/uiStore";
import { useAuthStore } from "../store/authStore";
import clsx from "clsx";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Дашборд" },
  { to: "/products", icon: Package, label: "Товары" },
  { to: "/tech-cards", icon: ChefHat, label: "Тех карты" },
  { to: "/categories", icon: Tags, label: "Категории" },
  { to: "/orders", icon: ShoppingCart, label: "Заказы" },
  { to: "/kitchen", icon: Utensils, label: "Кухня" },
  { to: "/payments", icon: CreditCard, label: "Оплаты" },
  { to: "/inventory", icon: Warehouse, label: "Склад" },
  { to: "/stock-receipts", icon: FileText, label: "Приходы" },
  { to: "/cash-shifts", icon: Clock, label: "Смены" },
  { to: "/tables", icon: Grid3X3, label: "Столы" },
  { to: "/users", icon: Users, label: "Сотрудники" },
  { to: "/reports", icon: BarChart3, label: "Отчёты" },
  { to: "/settings", icon: Settings, label: "Настройки" },
];

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const user = useAuthStore((s) => s.user);
  const userInitial = user?.firstName?.[0] || user?.email?.[0] || "U";
  const userName = user ? `${user.firstName} ${user.lastName}` : "Пользователь";
  const userEmail = user?.email || "";

  return (
    <aside
      className={clsx(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-gray-200 bg-white transition-all duration-300 dark:border-gray-700 dark:bg-gray-800",
        sidebarOpen ? "w-64" : "w-20"
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600">
            <Store className="h-5 w-5 text-white" />
          </div>
          {sidebarOpen && (
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Qwik</span>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        >
          <ChevronLeft
            className={clsx("h-5 w-5 transition-transform", !sidebarOpen && "rotate-180")}
          />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
              )
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {sidebarOpen && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-gray-200 p-4 dark:border-gray-700">
        {sidebarOpen ? (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700 dark:bg-primary-900/40 dark:text-primary-400">
              {userInitial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{userName}</p>
              <p className="truncate text-xs text-gray-500">{userEmail}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700 dark:bg-primary-900/40 dark:text-primary-400">
              {userInitial}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
