import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import clsx from "clsx";
import EmptyState from "./EmptyState";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  /** Текст ошибки загрузки; вместе с onRetry — кнопка «Повторить». */
  error?: string | null;
  onRetry?: () => void;
  /** Что показать, когда строк нет (обычно EmptyState с главным действием). */
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  /** Ширина, после которой таблица прокручивается вбок, а не сжимает колонки. */
  minWidth?: number;
  caption?: string;
}

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const;

/**
 * Таблица с тремя состояниями, которые раньше каждая страница рисовала по-своему
 * (или не рисовала): загрузка — строки-заглушки той же высоты, пусто — EmptyState,
 * ошибка — текст и «Повторить». Строки чередуются, как в чеке кассы.
 */
export default function DataTable<T>({ columns, rows, rowKey, loading, error, onRetry, empty, onRowClick, minWidth, caption }: DataTableProps<T>) {
  const span = columns.length;
  return (
    <div className="card overflow-x-auto p-0 sm:p-0">
      <table className="w-full" style={minWidth ? { minWidth } : undefined} aria-busy={loading || undefined}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
            {columns.map((column) => (
              <th key={column.key} scope="col" className={clsx("px-4 py-3", ALIGN[column.align ?? "left"], column.className)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading ? (
            [0, 1, 2].map((i) => (
              <tr key={i}>
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3.5">
                    <span className="block h-4 animate-pulse rounded-sm bg-gray-100" />
                  </td>
                ))}
              </tr>
            ))
          ) : error ? (
            <tr>
              <td colSpan={span}>
                <EmptyState
                  compact
                  icon={<AlertTriangle className="h-6 w-6 text-danger-600" />}
                  title="Не удалось загрузить"
                  description={error}
                  action={onRetry && <button onClick={onRetry} className="btn-secondary">Повторить</button>}
                />
              </td>
            </tr>
          ) : !rows?.length ? (
            <tr>
              <td colSpan={span}>{empty ?? <EmptyState compact title="Пока пусто" />}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={clsx("even:bg-gray-50/60 hover:bg-gray-50", onRowClick && "cursor-pointer")}
              >
                {columns.map((column) => (
                  <td key={column.key} className={clsx("px-4 py-3.5 text-sm text-gray-700", ALIGN[column.align ?? "left"], column.className)}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
