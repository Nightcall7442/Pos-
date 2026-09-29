import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Store, Eye, EyeOff, ArrowLeft } from "lucide-react";
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-white to-blue-50 px-4 py-10 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 shadow-lg shadow-primary-600/30">
            <Store className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-4 text-3xl font-bold text-gray-900 dark:text-gray-100">Регистрация</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">Создайте заведение и аккаунт администратора</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5">
          <div>
            <label className="label">Название заведения</label>
            <input
              type="text"
              value={form.tenantName}
              onChange={(e) => setForm({ ...form, tenantName: e.target.value })}
              className="input"
              placeholder="Кафе «Ромашка»"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Имя</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Фамилия</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="input"
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Электронная почта</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
              placeholder="admin@example.com"
              required
            />
          </div>

          <div>
            <label className="label">Телефон (необязательно)</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input"
              placeholder="+998 90 000 00 00"
            />
          </div>

          <div>
            <label className="label">Пароль</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input pr-10"
                placeholder="Минимум 8 символов"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {passwordTooShort && <p className="mt-1 text-sm text-red-600">Пароль не короче 8 символов</p>}
          </div>

          <div>
            <label className="label">Повторите пароль</label>
            <input
              type={showPassword ? "text" : "password"}
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              className="input"
              required
            />
            {passwordMismatch && <p className="mt-1 text-sm text-red-600">Пароли не совпадают</p>}
          </div>

          <button type="submit" disabled={!canSubmit || registerMutation.isPending} className="btn-primary w-full">
            {registerMutation.isPending ? "Создаём..." : "Создать заведение"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <Link to="/login" className="inline-flex items-center gap-1 font-medium text-primary-600 hover:text-primary-700">
            <ArrowLeft className="h-4 w-4" />
            Уже есть аккаунт — войти
          </Link>
        </p>
      </div>
    </div>
  );
}
