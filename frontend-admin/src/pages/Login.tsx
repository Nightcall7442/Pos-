import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useLogin } from "../hooks/useAuth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const loginMutation = useLogin();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { email, password },
      { onSuccess: () => navigate("/") }
    );
  };

  return (
    <div className="auth-screen">
      <div className="auth-box">
        <div className="auth-head">
          <div className="auth-kicker">Панель управления</div>
          <h1 className="auth-title">Qwik</h1>
          <p className="auth-sub">Войдите, чтобы управлять товарами, складом и сменами.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-card">
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-email">Электронная почта</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              placeholder="admin@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="login-password">Пароль</label>
            <div className="auth-input-wrap">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
                style={{ paddingRight: 40 }}
                placeholder="Введите пароль"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="auth-reveal"
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loginMutation.isPending} className="auth-submit">
            {loginMutation.isPending ? (
              <>
                <span className="auth-spinner" />
                Вход…
              </>
            ) : (
              "Войти"
            )}
          </button>
        </form>

        <p className="auth-foot">
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </p>
      </div>
    </div>
  );
}
