import { cloneElement, useId, type ReactElement, type ReactNode } from "react";
import clsx from "clsx";

interface ControlProps {
  id?: string;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

interface FormFieldProps {
  label: string;
  /** Подсказка под полем: формат, пример, зачем это поле. */
  hint?: ReactNode;
  /** Текст ошибки: поле получает aria-invalid и красную рамку. */
  error?: string | null;
  required?: boolean;
  /** Одно поле: input, textarea, select или Select. */
  children: ReactElement<ControlProps>;
  className?: string;
}

/**
 * Подпись + поле + подсказка + ошибка. Раньше это собиралось руками на каждой
 * странице, и подпись не была связана с полем: клик по ней не ставил фокус, а
 * экранный диктор не читал ни подсказку, ни ошибку.
 */
export default function FormField({ label, hint, error, required, children, className }: FormFieldProps) {
  const autoId = useId();
  const fieldId = children.props.id ?? autoId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  const control = cloneElement(children, {
    id: fieldId,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": [errorId, hintId].filter(Boolean).join(" ") || undefined,
    className: clsx(children.props.className, error && "input-invalid"),
  });

  return (
    <div className={className}>
      <label htmlFor={fieldId} className="label">
        {label}
        {required && (
          <span className="ml-0.5 text-danger-600" aria-hidden>
            *
          </span>
        )}
      </label>
      {control}
      {error && (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-danger-600">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-gray-500">
          {hint}
        </p>
      )}
    </div>
  );
}
