import { useRef, type KeyboardEvent, type ReactNode } from "react";
import clsx from "clsx";

export interface TabItem<T extends string = string> {
  value: T;
  label: ReactNode;
  count?: number;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Что переключают вкладки — для экранного диктора. */
  label: string;
  className?: string;
}

/**
 * Вкладки по образцу WAI-ARIA: в ряду одна точка Tab, стрелки ←/→, Home и End
 * переключают и переводят фокус. На узком экране ряд прокручивается.
 */
export default function Tabs<T extends string>({ items, value, onChange, label, className }: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = items.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    onChange(items[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={clsx("flex gap-1 overflow-x-auto overflow-y-hidden border-b border-gray-200", className)}>
      {items.map((item, index) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={clsx(
              "-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              selected ? "border-primary-600 text-primary-700" : "border-transparent text-gray-500 hover:text-gray-800"
            )}
          >
            {item.label}
            {item.count !== undefined && <span className="ml-1.5 rounded-sm bg-gray-100 px-1.5 text-xs tabular-nums text-gray-600">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
