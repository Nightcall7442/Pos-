import { useId, type ReactNode } from "react";
import clsx from "clsx";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
}

/**
 * Переключатель «вкл / выкл» — для настроек, которые действуют сразу. Для
 * пункта формы, который сохраняется кнопкой, — Checkbox.
 */
export default function Toggle({ checked, onChange, label, description, disabled, id }: ToggleProps) {
  const autoId = useId();
  const labelId = `${id ?? autoId}-label`;
  return (
    <div className={clsx("flex items-start justify-between gap-4", disabled && "opacity-60")}>
      <span id={labelId} className="text-sm">
        <span className="font-medium text-gray-900">{label}</span>
        {description && <span className="mt-0.5 block text-gray-500">{description}</span>}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed",
          checked ? "bg-primary-600" : "bg-gray-300"
        )}
      >
        <span className={clsx("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </div>
  );
}
