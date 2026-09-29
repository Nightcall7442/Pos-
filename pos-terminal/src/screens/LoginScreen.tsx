import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import api, { storeTokens } from "../services/api";
import toast from "react-hot-toast";

interface LoginScreenProps {
  onLogin: (user: { id: string; firstName: string; lastName: string; email: string; role: string }, token: string) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);

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
    <div className="pos-auth">
      <div className="pos-auth-box">
        <div className="pos-auth-head">
          <div className="pos-auth-kicker">Qwik</div>
          <h1 className="pos-auth-title">
            Смена <em>начинается</em> здесь
          </h1>
          <p className="pos-auth-sub">Войдите, чтобы открыть кассу.</p>
        </div>

        {/* form, а не просто кнопка: на планшете клавиатура показывает «Ввод»,
            и вход срабатывает из любого поля */}
        <form
          className="pos-auth-card"
          onSubmit={(e) => {
            e.preventDefault();
            void handleLogin();
          }}
        >
          <div className="pos-auth-field">
            <label className="pos-auth-label" htmlFor="pos-email">
              Email
            </label>
            <input
              id="pos-email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cashier@example.com"
              className="pos-auth-input"
            />
          </div>

          <div className="pos-auth-field">
            <label className="pos-auth-label" htmlFor="pos-pin">
              Пароль или PIN
            </label>
            <div className="pos-auth-input-wrap">
              <input
                id="pos-pin"
                type={showPin ? "text" : "password"}
                autoComplete="current-password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="pos-auth-input"
              />
              <button
                type="button"
                className="pos-auth-reveal"
                onClick={() => setShowPin((v) => !v)}
                aria-label={showPin ? "Скрыть" : "Показать"}
              >
                {showPin ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </div>

          <button type="submit" className="pos-auth-submit" disabled={loading}>
            {loading ? (
              <>
                <span className="pos-auth-spinner" />
                Входим…
              </>
            ) : (
              "Войти"
            )}
          </button>
        </form>

        <p className="pos-auth-foot">Доступ выдаёт администратор заведения</p>
      </div>
    </div>
  );
}
