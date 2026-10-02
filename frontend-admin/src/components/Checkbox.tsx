import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  description?: ReactNode;
}

/** Флажок с подписью: вся строка — цель для клика, а не квадрат 16 px. */
export default function Checkbox({ label, description, className, id, disabled, ...rest }: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label htmlFor={inputId} className={clsx("flex items-start gap-3", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer", className)}>
      <input
        id={inputId}
        type="checkbox"
        disabled={disabled}
        className="mt-0.5 h-4 w-4 shrink-0 accent-primary-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
        {...rest}
      />
      <span className="text-sm">
        <span className="font-medium text-gray-900">{label}</span>
        {description && <span className="mt-0.5 block text-gray-500">{description}</span>}
      </span>
    </label>
  );
}
