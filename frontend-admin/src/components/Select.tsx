import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options?: SelectOption[];
  /** Пустой первый пункт: «Все категории», «Выберите…». */
  placeholder?: string;
}

/**
 * Родной select в стиле .input: на планшете и телефоне открывается системный
 * список — его не надо переизобретать. Стрелка своя, одинаковая во всех браузерах.
 */
const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ options, placeholder, className, children, ...rest }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={clsx("input appearance-none pr-10", className)} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options?.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden />
    </div>
  );
});

export default Select;
