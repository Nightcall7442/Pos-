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
import { canOpenPath } from "../utils/access";
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
  // Повару из всего меню положена одна «Кухня» — остальное не показываем,
  // чтобы он не упирался в пункты, которые всё равно не откроются.
  const items = navItems.filter((item) => canOpenPath(user?.role, item.to));
  const userInitial = user?.firstName?.[0] || user?.email?.[0] || "U";
  const userName = user ? `${user.firstName} ${user.lastName}` : "Пользователь";
  const userEmail = user?.email || "";

  return (
    <aside
      className={clsx(
        "fixed left-0 top-0 z-40 flex h-screen flex-col bg-bar-2 text-bar-fg transition-all duration-300",
        sidebarOpen ? "w-64" : "w-20"
      )}
    >
      <div className="flex h-14 items-center justify-between bg-bar px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-bar-active">
            <Store className="h-5 w-5 text-white" />
          </div>
          {sidebarOpen && (
            <span className="text-lg font-semibold text-white">Qwik</span>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          className="rounded p-1.5 text-bar-muted hover:bg-bar-hover hover:text-white"
        >
          <ChevronLeft
            className={clsx("h-5 w-5 transition-transform", !sidebarOpen && "rotate-180")}
          />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-bar-active text-white"
                  : "text-bar-fg hover:bg-bar-hover hover:text-white"
              )
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {sidebarOpen && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        {sidebarOpen ? (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bar-active text-sm font-semibold text-white">
              {userInitial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{userName}</p>
              <p className="truncate text-xs text-bar-muted">{userEmail}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bar-active text-sm font-semibold text-white">
              {userInitial}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
