import type { ReactNode } from "react";
import Modal from "./Modal";
import Button from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Необратимое действие: красная кнопка, фокус — на «Отмене». */
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Подтверждение необратимого действия. Для обратимого лучше notify.undo
 * («Удалено · Вернуть»): подтверждение замедляет каждое действие, отмена — только ошибочное.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={open} onClose={onCancel} title={title} size="sm">
      {description && <div className="text-sm text-gray-600">{description}</div>}
      <div className="mt-5 flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel} data-autofocus={danger || undefined}>
          {cancelLabel}
        </Button>
        <Button variant={danger ? "danger" : "primary"} loading={loading} onClick={onConfirm} data-autofocus={!danger || undefined}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
