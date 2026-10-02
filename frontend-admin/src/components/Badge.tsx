import clsx from "clsx";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "warning" | "danger" | "info" | "gray";
  className?: string;
}

// Статус — плашкой с прямыми углами, как в таблицах кассы; цвет — по смыслу (D-5).
const BASE = "inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-medium";
const variantMap = {
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-800",
  danger: "bg-danger-50 text-danger-700",
  info: "bg-info-50 text-info-700",
  gray: "bg-gray-100 text-gray-700",
};

export default function Badge({ children, variant = "gray", className }: BadgeProps) {
  return <span className={clsx(BASE, variantMap[variant], className)}>{children}</span>;
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
