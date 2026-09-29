import clsx from "clsx";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "warning" | "danger" | "info" | "gray";
  className?: string;
}

const variantMap = {
  success: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  warning: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  danger: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  info: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  gray: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
};

export default function Badge({ children, variant = "gray", className }: BadgeProps) {
  return (
    <span className={clsx(variantMap[variant], className)}>
      {children}
    </span>
  );
}

export function statusBadge(status: string) {
  const map: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
    pending: { variant: "warning", label: "Ожидает" },
    confirmed: { variant: "info", label: "Подтверждён" },
    preparing: { variant: "info", label: "Готовится" },
    ready: { variant: "success", label: "Готов" },
    served: { variant: "success", label: "Подан" },
    completed: { variant: "success", label: "Завершён" },
    cancelled: { variant: "danger", label: "Отменён" },
    available: { variant: "success", label: "Свободен" },
    occupied: { variant: "danger", label: "Занят" },
    reserved: { variant: "info", label: "Забронирован" },
    maintenance: { variant: "warning", label: "Обслуживание" },
  };

  return map[status] || { variant: "gray" as const, label: status };
}
