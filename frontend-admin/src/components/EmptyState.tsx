import { Package } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  /** Главное действие раздела — одна-две кнопки. */
  action?: React.ReactNode;
  /** Внутри карточки или таблицы — с меньшим отступом. */
  compact?: boolean;
}

/**
 * Пустой список (D-8): одна фраза о том, что это за раздел, и одна кнопка, которая
 * ведёт дальше. Для «поиск ничего не нашёл» — то же, но кнопка сбрасывает поиск.
 */
export default function EmptyState({ icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "px-4 py-10" : "py-16"}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-100 text-gray-500">
        {icon || <Package className="h-6 w-6" />}
      </div>
      <h3 className="mt-4 text-base font-semibold text-gray-900">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-3">{action}</div>}
    </div>
  );
}
