import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Delete, Eye, EyeOff, RefreshCw } from "lucide-react";
import api, { storeTokens } from "../services/api";
import toast from "react-hot-toast";

type LoginUser = { id: string; firstName: string; lastName: string; email: string; role: string };

interface LoginScreenProps {
  onLogin: (user: LoginUser, token: string) => void;
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: string;
}

// Код точки хранится на планшете: его вводят один раз при настройке кассы,
// дальше экран сразу открывается плитками сотрудников.
const TENANT_KEY = "pos-tenant";

const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  manager: "Менеджер",
  cashier: "Кассир",
  waiter: "Официант",
  kitchen: "Кухня",
};

const PIN_MIN = 4;
const PIN_MAX = 10;

type Stage = "loading" | "pairing" | "staff" | "pin" | "email";

function readTenant(): string | null {
  try {
    return localStorage.getItem(TENANT_KEY);
  } catch {
    return null;
  }
}

function errorText(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: { error?: string } } };
  if (err.response?.data?.error) return err.response.data.error;
  if (!err.response) return "Нет связи с сервером";
  return fallback;
}

function initials(member: { firstName: string; lastName: string }): string {
  return `${member.firstName?.[0] ?? ""}${member.lastName?.[0] ?? ""}`.toUpperCase();
}

// «Имя Ф.» — у двух Анн на смене плитки всё равно должны различаться.
function shortName(member: { firstName: string; lastName: string }): string {
  return member.lastName ? `${member.firstName} ${member.lastName[0]}.` : member.firstName;
}

function Avatar({ member }: { member: StaffMember }) {
  return (
    <div className="pos-avatar">
      {member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : initials(member)}
    </div>
  );
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [tenant, setTenant] = useState<string | null>(readTenant);
  // Непривязанный планшет сразу показывает привязку — без лишнего рендера
  // «загрузки» и записи стадии из эффекта.
  const [stage, setStage] = useState<Stage>(() => (readTenant() ? "loading" : "pairing"));
  const [tenantName, setTenantName] = useState("");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selected, setSelected] = useState<StaffMember | null>(null);

  const [codeInput, setCodeInput] = useState("");
  const [pairingError, setPairingError] = useState("");
  const [busy, setBusy] = useState(false);

  const [digits, setDigits] = useState("");
  const [pinError, setPinError] = useState("");

  // Запасной вход: для админа, который настраивает кассу, и пока ни у кого
  // не задан PIN.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const loadStaff = useCallback(async (code: string): Promise<void> => {
    const res = await api.get("/auth/staff", { params: { tenant: code } });
    const data = res.data.data as { tenantName: string; staff: StaffMember[] };
    setTenantName(data.tenantName);
    setStaff(data.staff);
  }, []);

  // При запуске: если планшет уже привязан — сразу плитки.
  useEffect(() => {
    if (!tenant) return;
    // loadStaff пишет состояние после ответа сервера (await), а не синхронно.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- загрузка по сети
    loadStaff(tenant)
      .then(() => setStage("staff"))
      .catch((error) => {
        const status = (error as { response?: { status?: number } }).response?.status;
        if (status === 404) {
          // Точку удалили или код сменился — привязку начинаем заново.
          localStorage.removeItem(TENANT_KEY);
          setTenant(null);
          setPairingError("Сохранённый код точки больше не действует. Введите новый.");
          setStage("pairing");
        } else {
          toast.error(errorText(error, "Не удалось загрузить сотрудников"));
          setStage("email");
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePair = async (): Promise<void> => {
    const code = codeInput.trim().toLowerCase();
    if (!code) {
      setPairingError("Введите код точки");
      return;
    }
    setBusy(true);
    setPairingError("");
    try {
      await loadStaff(code);
      localStorage.setItem(TENANT_KEY, code);
      setTenant(code);
      setStage("staff");
    } catch (error) {
      setPairingError(errorText(error, "Точка не найдена — проверьте код"));
    } finally {
      setBusy(false);
    }
  };

  const refreshStaff = async (): Promise<void> => {
    if (!tenant) return;
    setBusy(true);
    try {
      await loadStaff(tenant);
    } catch (error) {
      toast.error(errorText(error, "Не удалось обновить список"));
    } finally {
      setBusy(false);
    }
  };

  const unpair = (): void => {
    localStorage.removeItem(TENANT_KEY);
    setTenant(null);
    setStaff([]);
    setCodeInput("");
    setPairingError("");
    setStage("pairing");
  };

  const choose = (member: StaffMember): void => {
    setSelected(member);
    setDigits("");
    setPinError("");
    setStage("pin");
  };

  const finish = (data: { user: LoginUser; accessToken: string; refreshToken: string }): void => {
    storeTokens(data.accessToken, data.refreshToken);
    onLogin(data.user, data.accessToken);
    toast.success(`Добро пожаловать, ${data.user.firstName}!`);
  };

  const submitPin = useCallback(async (): Promise<void> => {
    if (!selected || !tenant || digits.length < PIN_MIN || busy) return;
    setBusy(true);
    setPinError("");
    try {
      const res = await api.post("/auth/login-pin", { tenant, userId: selected.id, pin: digits });
      finish(res.data.data);
    } catch (error) {
      setPinError(errorText(error, "Неверный PIN"));
      setDigits("");
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, tenant, digits, busy]);

  const press = useCallback((key: string): void => {
    setPinError("");
    setDigits((current) => (current.length >= PIN_MAX ? current : current + key));
  }, []);

  const erase = useCallback((): void => {
    setPinError("");
    setDigits((current) => current.slice(0, -1));
  }, []);

  // На кассе бывает подключена клавиатура — цифры, Backspace и Enter работают
  // так же, как нажатия на экране.
  useEffect(() => {
    if (stage !== "pin") return;
    const onKey = (e: KeyboardEvent): void => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") erase();
      else if (e.key === "Enter") void submitPin();
      else if (e.key === "Escape") setStage("staff");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, press, erase, submitPin]);

  const handleEmailLogin = async (): Promise<void> => {
    if (!email || !password) {
      toast.error("Введите email и пароль");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      finish(res.data.data);
    } catch (error) {
      toast.error(errorText(error, "Ошибка входа"));
    } finally {
      setBusy(false);
    }
  };

  // ── Экраны ──────────────────────────────────────────────────────────────

  if (stage === "loading") {
    return <div className="pos-auth" />;
  }

  if (stage === "pairing") {
    return (
      <div className="pos-auth">
        <div className="pos-auth-box">
          <div className="pos-auth-head">
            <div className="pos-auth-kicker">Qwik · настройка кассы</div>
            <h1 className="pos-auth-title">
              Привяжите <em>кассу</em>
            </h1>
            <p className="pos-auth-sub">
              Код точки есть в панели управления: «Настройки» → «Касса». Вводится один раз.
            </p>
          </div>
          <form
            className="pos-auth-card"
            onSubmit={(e) => {
              e.preventDefault();
              void handlePair();
            }}
          >
            <div className="pos-auth-field">
              <label className="pos-auth-label" htmlFor="pos-code">
                Код точки
              </label>
              <input
                id="pos-code"
                className="pos-auth-input"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="например, my-shop"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
              />
              {pairingError && <p className="pos-auth-hint">{pairingError}</p>}
            </div>
            <button type="submit" className="pos-auth-submit" disabled={busy}>
              {busy ? (
                <>
                  <span className="pos-auth-spinner" />
                  Проверяем…
                </>
              ) : (
                "Продолжить"
              )}
            </button>
          </form>
          <button type="button" className="pos-auth-link" onClick={() => setStage("email")}>
            Войти по email и паролю
          </button>
        </div>
      </div>
    );
  }

  if (stage === "staff") {
    return (
      <div className="pos-auth">
        <div className="pos-auth-box pos-auth-box--wide">
          <div className="pos-auth-head">
            <div className="pos-auth-kicker">{tenantName || "Qwik"}</div>
            <h1 className="pos-auth-title">
              Кто <em>на смене?</em>
            </h1>
            <p className="pos-auth-sub">Нажмите своё имя и наберите PIN.</p>
          </div>

          {staff.length > 0 ? (
            <div className="pos-staff-grid">
              {staff.map((member) => (
                <button key={member.id} type="button" className="pos-staff-tile" onClick={() => choose(member)}>
                  <Avatar member={member} />
                  <span className="pos-staff-name">{shortName(member)}</span>
                  <span className="pos-staff-role">{ROLE_LABELS[member.role] ?? member.role}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="pos-staff-empty">
              Ни у кого из сотрудников пока нет PIN.
              <br />
              Администратор задаёт его в панели управления, раздел «Сотрудники».
            </div>
          )}

          <div className="pos-auth-links">
            <button type="button" className="pos-auth-link" onClick={() => void refreshStaff()} disabled={busy}>
              <RefreshCw size={12} style={{ display: "inline", marginRight: 5, verticalAlign: -1 }} />
              Обновить список
            </button>
            <button type="button" className="pos-auth-link" onClick={() => setStage("email")}>
              Войти по email
            </button>
            <button type="button" className="pos-auth-link" onClick={unpair}>
              Сменить точку
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "pin" && selected) {
    const ready = digits.length >= PIN_MIN;
    const dotCount = Math.max(PIN_MIN, digits.length);
    return (
      <div className="pos-auth">
        <div className="pos-auth-box">
          <div className="pos-pin">
            <button type="button" className="pos-pin-back" onClick={() => setStage("staff")}>
              <ArrowLeft size={16} />
              Назад
            </button>

            <div className="pos-pin-who">
              <Avatar member={selected} />
              <span className="pos-staff-name">{shortName(selected)}</span>
            </div>

            <div className={`pos-pin-dots${pinError ? " pos-pin-dots--error" : ""}`} key={pinError}>
              {Array.from({ length: dotCount }, (_, i) => (
                <span key={i} className={`pos-pin-dot${i < digits.length ? " pos-pin-dot--on" : ""}`} />
              ))}
            </div>
            {pinError && (
              <p className="pos-auth-hint" style={{ textAlign: "center", marginTop: -12, marginBottom: 14 }}>
                {pinError}
              </p>
            )}

            <div className="pos-pin-pad">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button key={d} type="button" className="pos-pin-key" onClick={() => press(d)} disabled={busy}>
                  {d}
                </button>
              ))}
              <button
                type="button"
                className="pos-pin-key pos-pin-key--muted"
                onClick={erase}
                disabled={busy || digits.length === 0}
                aria-label="Стереть"
              >
                <Delete size={20} />
              </button>
              <button type="button" className="pos-pin-key" onClick={() => press("0")} disabled={busy}>
                0
              </button>
              <button
                type="button"
                className="pos-pin-key pos-pin-key--go"
                onClick={() => void submitPin()}
                disabled={busy || !ready}
                aria-label="Войти"
              >
                {busy ? <span className="pos-auth-spinner" style={{ marginRight: 0 }} /> : <Check size={24} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // stage === "email"
  return (
    <div className="pos-auth">
      <div className="pos-auth-box">
        <div className="pos-auth-head">
          <div className="pos-auth-kicker">Qwik</div>
          <h1 className="pos-auth-title">
            Вход по <em>email</em>
          </h1>
          <p className="pos-auth-sub">Для администратора и тех, у кого ещё нет PIN.</p>
        </div>

        <form
          className="pos-auth-card"
          onSubmit={(e) => {
            e.preventDefault();
            void handleEmailLogin();
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
            <label className="pos-auth-label" htmlFor="pos-password">
              Пароль
            </label>
            <div className="pos-auth-input-wrap">
              <input
                id="pos-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pos-auth-input"
              />
              <button
                type="button"
                className="pos-auth-reveal"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Скрыть" : "Показать"}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </div>

          <button type="submit" className="pos-auth-submit" disabled={busy}>
            {busy ? (
              <>
                <span className="pos-auth-spinner" />
                Входим…
              </>
            ) : (
              "Войти"
            )}
          </button>
        </form>

        <button
          type="button"
          className="pos-auth-link"
          onClick={() => {
            setPairingError("");
            setStage(tenant ? "staff" : "pairing");
          }}
        >
          ← {tenant ? "Вход по имени и PIN" : "Привязать кассу"}
        </button>
      </div>
    </div>
  );
}
