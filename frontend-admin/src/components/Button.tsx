import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  danger: "btn-danger",
  ghost: "btn-ghost",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Идёт запрос: кнопка недоступна, вместо значка — индикатор. */
  loading?: boolean;
  icon?: ReactNode;
}

/**
 * Кнопка поверх классов .btn-* (index.css): те же стили, плюс состояние загрузки.
 * type по умолчанию — button, чтобы кнопка в форме не отправляла её случайно.
 */
export default function Button({ variant = "primary", loading = false, icon, disabled, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={clsx(VARIANT[variant], "gap-2", className)} {...rest}>
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : icon}
      {children}
    </button>
  );
}
