import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Search, Moon, Sun, LogOut, Menu } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import { useLogout } from "../hooks/useAuth";
import api from "../services/api";
import NotificationsPanel from "./NotificationsPanel";

export default function Header() {
  const user = useAuthStore((s) => s.user);
  const { theme, toggleTheme, mobileNavOpen, setMobileNavOpen } = useUIStore();
  const logout = useLogout();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: () => api.get("/notifications").then((r) => r.data.data?.unreadCount || 0),
    refetchInterval: 30000,
  });

  const unreadCount = data || 0;

  return (
    <header className="relative flex h-14 items-center gap-2 bg-bar px-3 text-bar-fg sm:px-6">
      <button
        onClick={() => setMobileNavOpen(true)}
        aria-label="Открыть меню"
        aria-controls="app-nav"
        aria-expanded={mobileNavOpen}
        className="-ml-1 flex h-10 w-10 items-center justify-center rounded text-bar-fg hover:bg-bar-hover hover:text-white lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="relative hidden md:block md:w-72 lg:w-96">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bar-muted" />
        <input
          type="text"
          placeholder="Поиск товаров, заказов..."
          aria-label="Поиск по панели"
          className="block h-9 w-full rounded border border-white/10 bg-white/5 pl-10 pr-3 text-sm text-bar-fg placeholder:text-bar-muted focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-primary-400/60"
        />
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <button
          onClick={toggleTheme}
          aria-label={theme === "light" ? "Тёмная тема" : "Светлая тема"}
          className="rounded p-2 text-bar-muted hover:bg-bar-hover hover:text-white"
        >
          {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </button>
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            aria-label={unreadCount > 0 ? `Уведомления: ${unreadCount} новых` : "Уведомления"}
            aria-expanded={notificationsOpen}
            aria-controls="notifications-panel"
            className="relative rounded p-2 text-bar-muted hover:bg-bar-hover hover:text-white"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger-solid text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <NotificationsPanel
            open={notificationsOpen}
            onClose={() => setNotificationsOpen(false)}
          />
        </div>
        <div className="ml-1 flex items-center gap-3 border-l border-white/10 pl-2 sm:ml-2 sm:pl-4">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-white">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-bar-muted capitalize">{user?.role === "admin" ? "Администратор" : user?.role === "cashier" ? "Кассир" : user?.role}</p>
          </div>
          <button
            onClick={logout}
            aria-label="Выйти"
            className="rounded p-2 text-bar-muted hover:bg-bar-hover hover:text-danger-400"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
