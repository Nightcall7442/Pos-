import type { RefObject } from "react";
import { Keyboard, LayoutGrid, ReceiptText, ScanBarcode } from "lucide-react";
import type { Product } from "../../types";
import { emojiFor, productTitle, shelfPrice, stockLabel } from "./shopProduct";

interface ScanBarProps {
  inputRef: RefObject<HTMLInputElement>;
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
  onArrow: (direction: 1 | -1) => void;
  onEscape: () => void;
  suggestions: Product[];
  suggestOpen: boolean;
  suggestLoading: boolean;
  suggestError?: string | null;
  suggestIndex: number;
  onSuggestIndex: (index: number) => void;
  onPick: (product: Product) => void;
  view: "receipt" | "tiles";
  onToggleView: () => void;
  screenKeyboard: boolean;
  onToggleKeyboard: () => void;
  money: (amount: number) => string;
}

/**
 * The register's front door. It is focused all the time: a scanner "types" the
 * barcode and presses Enter, and whatever is typed by hand (a name, a short
 * code, "5*" for a multiplier) goes through the same field.
 */
export default function ScanBar(props: ScanBarProps) {
  const { inputRef, value, onChange, onEnter, onArrow, onEscape, suggestions, suggestOpen, suggestLoading, suggestError, suggestIndex, onSuggestIndex, onPick, view, onToggleView, screenKeyboard, onToggleKeyboard, money } = props;

  return (
    <div className="sh-scan">
      <ScanBarcode className="i" />
      <input
        ref={inputRef}
        className="sh-scan-input"
        value={value}
        placeholder="Штрихкод, код или название товара"
        // Without a physical keyboard the on-screen one would cover half the
        // register every time the field is focused; it is opt-in (the button).
        inputMode={screenKeyboard ? "text" : "none"}
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || (e.key === "Tab" && value.trim())) {
            // Some scanners end the code with Tab instead of Enter.
            e.preventDefault();
            onEnter();
          } else if (e.key === "ArrowDown" && suggestOpen) {
            e.preventDefault();
            onArrow(1);
          } else if (e.key === "ArrowUp" && suggestOpen) {
            e.preventDefault();
            onArrow(-1);
          } else if (e.key === "Escape") {
            onEscape();
          }
        }}
      />
      <span className="sh-ready">
        <span className="sh-dot" />
        <span>Сканер готов</span>
      </span>
      <button className={`sh-tog sq${screenKeyboard ? " on" : ""}`} onClick={onToggleKeyboard} title="Экранная клавиатура" aria-label="Экранная клавиатура">
        <Keyboard className="i" />
      </button>
      <button className={`sh-tog${view === "tiles" ? " on" : ""}`} onClick={onToggleView}>
        {view === "tiles" ? <ReceiptText className="i" /> : <LayoutGrid className="i" />}
        {view === "tiles" ? "Чек" : "Плитки"}
      </button>

      {suggestOpen && (
        <div className="sh-sugg" role="listbox">
          {suggestions.length === 0 ? (
            <div className="sh-sugg-empty">{suggestLoading ? "Ищем…" : suggestError ?? "Ничего не найдено"}</div>
          ) : (
            suggestions.map((product, index) => {
              const price = shelfPrice(product);
              const stock = stockLabel(product);
              return (
                <button
                  key={product.id}
                  role="option"
                  aria-selected={index === suggestIndex}
                  className={`sh-sugg-item${index === suggestIndex ? " on" : ""}`}
                  // mouse down would blur the field before the click lands
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => onSuggestIndex(index)}
                  onClick={() => onPick(product)}
                >
                  <span className="sh-sugg-e">{emojiFor(product)}</span>
                  <span className="sh-sugg-n">
                    {productTitle(product)}
                    <small className="tab">{[product.barcode, product.sku && `код ${product.sku}`, stock && `ост. ${stock}`].filter(Boolean).join(" · ")}</small>
                  </span>
                  <span className="sh-sugg-p tab">
                    {money(price.amount)}
                    {price.per && <small> / {price.per}</small>}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
