import { useState } from "react";
import { Lock, User, Store, Sun, Moon } from "lucide-react";
import api, { storeTokens } from "../services/api";
import toast from "react-hot-toast";
import { useThemeStore } from "../store/themeStore";

interface LoginScreenProps {
  onLogin: (user: { id: string; firstName: string; lastName: string; email: string; role: string }, token: string) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const { theme, toggleTheme } = useThemeStore();

  const handleLogin = async (): Promise<void> => {
    if (!email || !pin) {
      toast.error("Введите email и пароль");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password: pin });
      const { user, accessToken, refreshToken } = res.data.data;
      storeTokens(accessToken, refreshToken);
      onLogin(user, accessToken);
      toast.success(`Добро пожаловать, ${user.firstName}!`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-dark-950 px-4">
      <button
        onClick={toggleTheme}
        className="absolute right-4 top-4 flex items-center justify-center rounded-xl bg-dark-800 p-2.5 text-dark-300 hover:text-dark-50 transition-colors"
        title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
      >
        {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center" style={{ animation: "slide-up 0.4s ease" }}>
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary-600 shadow-xl shadow-primary-600/30">
            <Store className="h-10 w-10 text-dark-50" />
          </div>
          <h1 className="mt-6 text-3xl font-bold text-dark-50">Qwik POS</h1>
          <p className="mt-2 text-sm text-dark-400">Войдите для начала работы</p>
        </div>

        <div className="space-y-4" style={{ animation: "slide-up 0.5s ease 0.1s both" }}>
          <div className="relative">
            <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-dark-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-2xl border-2 border-dark-600 bg-dark-800 py-4 pl-12 pr-4 text-base text-dark-50 placeholder:text-dark-500 focus:border-primary-500 focus:outline-none transition-colors"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-dark-400" />
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Пароль / PIN"
              className="w-full rounded-2xl border-2 border-dark-600 bg-dark-800 py-4 pl-12 pr-4 text-base text-dark-50 placeholder:text-dark-500 focus:border-primary-500 focus:outline-none transition-colors"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full rounded-2xl bg-primary-600 py-4 text-base font-semibold text-white shadow-lg shadow-primary-600/30 transition-all hover:bg-primary-500 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Вход...
              </div>
            ) : (
              "Войти"
            )}
          </button>
        </div>

        <p className="text-center text-xs text-dark-500">
          Введите данные для входа
        </p>
      </div>
    </div>
  );
}
