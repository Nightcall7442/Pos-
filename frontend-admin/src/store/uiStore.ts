import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  /** Широкий экран: меню развёрнуто (w-64) или свёрнуто до иконок (w-20). */
  sidebarOpen: boolean;
  /** Узкий экран (< lg): меню выезжает поверх страницы (D-4). Не запоминается. */
  mobileNavOpen: boolean;
  theme: "light" | "dark";
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  toggleTheme: () => void;
}

function applyTheme(theme: "light" | "dark") {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

// Apply saved theme on load
const saved = localStorage.getItem("pos-ui");
if (saved) {
  try {
    const parsed = JSON.parse(saved);
    if (parsed.state?.theme) applyTheme(parsed.state.theme);
  } catch {}
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      mobileNavOpen: false,
      theme: "light",
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
      toggleTheme: () =>
        set((s) => {
          const next = s.theme === "light" ? "dark" : "light";
          applyTheme(next);
          return { theme: next };
        }),
    }),
    {
      name: "pos-ui",
      // Выезжающее меню после перезагрузки должно быть закрыто.
      partialize: (s) => ({ sidebarOpen: s.sidebarOpen, theme: s.theme }),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) applyTheme(state.theme);
      },
    }
  )
);
