import { useEffect } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import Sidebar from "./Sidebar";
import Header from "./Header";
import NoPanelAccess from "./NoPanelAccess";
import { useUIStore } from "../store/uiStore";
import { canOpenPanel, canOpenPath, homePathFor } from "../utils/access";

export default function Layout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const mobileNavOpen = useUIStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUIStore((s) => s.setMobileNavOpen);
  const location = useLocation();

  // Переход на другую страницу закрывает выезжающее меню на телефоне.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname, setMobileNavOpen]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Вход такую роль уже не пропустит, но сессия могла сохраниться в браузере
  // раньше — и тогда по прямому адресу панель открылась бы снова.
  if (!canOpenPanel(user?.role)) return <NoPanelAccess />;

  // Повар работает только на «Кухне»; остальные адреса уводим туда же.
  if (!canOpenPath(user?.role, location.pathname)) {
    return <Navigate to={homePathFor(user?.role)} replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* Первая остановка Tab: без неё до содержимого 18 шагов по меню и шапке (WCAG 2.4.1). */}
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-action px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Перейти к содержимому
      </a>
      <Sidebar />
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Закрыть меню"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}
      {/* На узком экране меню не занимает места — оно выезжает поверх (D-4). */}
      <div className={`flex min-w-0 flex-1 flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? "lg:ml-64" : "lg:ml-20"}`}>
        <Header />
        <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto p-3 outline-none sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
