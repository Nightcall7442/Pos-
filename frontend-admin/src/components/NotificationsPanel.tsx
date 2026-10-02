import { useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, AlertTriangle, X } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import api from "../services/api";
import clsx from "clsx";

interface Notification {
  id: string;
  type: "order" | "stock";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface NotificationsPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function NotificationsPanel({ open, onClose }: NotificationsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications").then((r) => r.data.data),
    refetchInterval: 30000,
    enabled: open,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  if (!open) return null;

  const notifications: Notification[] = data?.notifications || [];

  return (
    <div
      ref={panelRef}
      className="fixed inset-x-3 top-14 z-50 mt-2 rounded-md border border-gray-200 bg-surface shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:w-96"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Уведомления</h3>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            Нет уведомлений
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={clsx(
                "flex gap-3 border-b border-gray-100 px-4 py-3 transition-colors hover:bg-gray-50",
                !n.read && "bg-primary-50/50"
              )}
            >
              <div
                className={clsx(
                  "mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                  n.type === "order"
                    ? "bg-info-100 text-info-600"
                    : "bg-warning-100 text-warning-600"
                )}
              >
                {n.type === "order" ? (
                  <ShoppingCart className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{n.title}</p>
                <p className="mt-0.5 text-xs text-gray-500">{n.message}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {format(new Date(n.createdAt), "d MMM, HH:mm", { locale: ru })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
