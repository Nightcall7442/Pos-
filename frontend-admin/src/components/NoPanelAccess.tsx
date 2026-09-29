import { useAuthStore } from "../store/authStore";
import { posUrl } from "../utils/access";

/**
 * Экран для роли, которой панель не положена.
 *
 * Показывается редко: вход такую роль уже не пускает. Сюда попадают сессии,
 * сохранённые в браузере до того, как проверка появилась, — поэтому важно
 * не просто выкинуть на /login (там бы вышла петля), а объяснить и дать
 * выход: ссылку на кассу и кнопку смены пользователя.
 */
export default function NoPanelAccess() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="auth-screen">
      <div className="auth-box">
        <div className="auth-head">
          <div className="auth-kicker">Панель управления</div>
          <h1 className="auth-title">
            Здесь <em>нечего</em> открывать
          </h1>
          <p className="auth-sub">
            {user ? `${user.firstName} ${user.lastName}, ваша` : "Ваша"} роль — работа за кассой,
            а не в панели управления. Панель ведут администратор и менеджер.
          </p>
        </div>

        <div className="auth-card">
          <a className="auth-submit" style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 0 }} href={posUrl()}>
            Перейти к кассе
          </a>
        </div>

        <p className="auth-foot">
          Вошли не под своей учётной записью?{" "}
          <a
            href="/login"
            onClick={(e) => {
              e.preventDefault();
              logout();
              window.location.href = "/login";
            }}
          >
            Сменить пользователя
          </a>
        </p>
      </div>
    </div>
  );
}
