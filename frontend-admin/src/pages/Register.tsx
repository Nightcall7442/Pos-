import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useRegister } from "../hooks/useAuth";

/**
 * Creates the shop (tenant) together with its first administrator. Without
 * this screen a fresh deployment could only be opened by running the demo
 * seed, which comes with a fixed "Demo Restaurant" and publicly known
 * passwords — not something to put on a live domain.
 */
export default function Register() {
  const [form, setForm] = useState({
    tenantName: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const registerMutation = useRegister();
  const navigate = useNavigate();

  const passwordTooShort = form.password.length > 0 && form.password.length < 8;
  const passwordMismatch = form.confirm.length > 0 && form.confirm !== form.password;
  const canSubmit =
    form.tenantName.trim() &&
    form.firstName.trim() &&
    form.lastName.trim() &&
    form.email.trim() &&
    form.password.length >= 8 &&
    form.confirm === form.password;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    registerMutation.mutate(
      {
        tenantName: form.tenantName.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
      },
      { onSuccess: () => navigate("/") }
    );
  };

  return (
    <div className="auth-screen">
      <div className="auth-box">
        <div className="auth-head">
          <div className="auth-kicker">Новое заведение</div>
          <h1 className="auth-title">Qwik</h1>
          <p className="auth-sub">Создайте точку и аккаунт администратора — это займёт минуту.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-card">
          <div className="auth-field">
            <label className="auth-label" htmlFor="reg-tenant">Название заведения</label>
            <input
              id="reg-tenant"
              type="text"
              value={form.tenantName}
              onChange={(e) => setForm({ ...form, tenantName: e.target.value })}
              className="auth-input"
              placeholder="Магазин «Ромашка»"
              required
            />
          </div>

          <div className="auth-field auth-grid">
            <div className="auth-field">
              <label className="auth-label" htmlFor="reg-first">Имя</label>
              <input
                id="reg-first"
                type="text"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="auth-input"
                autoComplete="given-name"
                required
              />
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="reg-last">Фамилия</label>
              <input
                id="reg-last"
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="auth-input"
                autoComplete="family-name"
                required
              />
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="reg-email">Электронная почта</label>
            <input
              id="reg-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="auth-input"
              placeholder="admin@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="reg-phone">Телефон (необязательно)</label>
            <input
              id="reg-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="auth-input"
              placeholder="+998 90 000 00 00"
              autoComplete="tel"
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="reg-password">Пароль</label>
            <div className="auth-input-wrap">
              <input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="auth-input"
                style={{ paddingRight: 40 }}
                placeholder="Минимум 8 символов"
                autoComplete="new-password"
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
            {passwordTooShort && <p className="auth-hint">Пароль не короче 8 символов</p>}
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="reg-confirm">Повторите пароль</label>
            <input
              id="reg-confirm"
              type={showPassword ? "text" : "password"}
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              className="auth-input"
              autoComplete="new-password"
              required
            />
            {passwordMismatch && <p className="auth-hint">Пароли не совпадают</p>}
          </div>

          <button type="submit" disabled={!canSubmit || registerMutation.isPending} className="auth-submit">
            {registerMutation.isPending ? (
              <>
                <span className="auth-spinner" />
                Создаём…
              </>
            ) : (
              "Создать заведение"
            )}
          </button>
        </form>

        <p className="auth-foot">
          <Link to="/login">← Уже есть аккаунт, войти</Link>
        </p>
      </div>
    </div>
  );
}
