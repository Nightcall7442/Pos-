import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Search, Moon, Sun, LogOut } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import { useLogout } from "../hooks/useAuth";
import api from "../services/api";
import NotificationsPanel from "./NotificationsPanel";

export default function Header() {
  const user = useAuthStore((s) => s.user);
  const { theme, toggleTheme } = useUIStore();
  const logout = useLogout();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: () => api.get("/notifications").then((r) => r.data.data?.unreadCount || 0),
    refetchInterval: 30000,
  });

  const unreadCount = data || 0;

  return (
    <header className="relative flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="relative w-96">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Поиск товаров, заказов..."
          className="input pl-10"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        >
          {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </button>
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <NotificationsPanel
            open={notificationsOpen}
            onClose={() => setNotificationsOpen(false)}
          />
        </div>
        <div className="ml-2 flex items-center gap-3 border-l border-gray-200 pl-4 dark:border-gray-600">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-gray-500 capitalize">{user?.role === "admin" ? "Администратор" : user?.role === "cashier" ? "Кассир" : user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700 dark:hover:text-red-400"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
