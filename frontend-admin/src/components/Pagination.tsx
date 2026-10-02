import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  total?: number;
}

/** «Страница 2 из 7» и стрелки. Одна страница — ничего не показываем. */
export default function Pagination({ page, totalPages, onChange, total }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Страницы" className="flex items-center justify-between gap-3 text-sm text-gray-600">
      <span className="tabular-nums">
        Страница {page} из {totalPages}
        {total !== undefined && ` · всего ${total}`}
      </span>
      <div className="flex gap-2">
        <button className="btn-secondary px-3 py-2" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Предыдущая страница">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button className="btn-secondary px-3 py-2" onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="Следующая страница">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
