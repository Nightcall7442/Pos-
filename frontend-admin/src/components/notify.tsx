import toast from "react-hot-toast";

/**
 * Уведомления поверх react-hot-toast — одни сроки и вид на всю панель.
 * Ошибка висит дольше успеха: её надо успеть прочитать.
 */
export const notify = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message, { duration: 5000 }),
  /** «Удалено · Вернуть» на 5 секунд — вместо подтверждения для обратимых действий. */
  undo: (message: string, onUndo: () => void) =>
    toast(
      (t) => (
        <span className="flex items-center gap-3">
          {message}
          <button
            type="button"
            className="-my-1 rounded px-2 py-1 font-semibold text-primary-300 hover:bg-white/10"
            onClick={() => {
              onUndo();
              toast.dismiss(t.id);
            }}
          >
            Вернуть
          </button>
        </span>
      ),
      { duration: 5000 }
    ),
};
