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
  const location = useLocation();

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
      <Sidebar />
      <div className={`flex flex-1 flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? "ml-64" : "ml-20"}`}>
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
