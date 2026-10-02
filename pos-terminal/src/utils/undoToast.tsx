import toast from "react-hot-toast";

/**
 * «Позиция убрана · Вернуть» на 5 секунд. На кассе отмена лучше подтверждения:
 * подтверждение замедляет каждое удаление, отмена — только ошибочное (D-7).
 */
export function undoToast(text: string, onUndo: () => void): void {
  toast(
    (t) => (
      <span className="pos-undo">
        {text}
        <button
          type="button"
          onClick={() => {
            onUndo();
            toast.dismiss(t.id);
          }}
        >
          Вернуть
        </button>
      </span>
    ),
    { id: "pos-undo", duration: 5000 }
  );
}
