import { Minus, Plus, Scale, ShoppingBasket, Trash2 } from "lucide-react";
import type { CartItem } from "../../types";
import { formatKg, pricePerKg } from "../../utils/weight";

interface ReceiptProps {
  items: CartItem[];
  selectedId: string | null;
  flashId: string | null;
  money: (amount: number) => string;
  onSelect: (id: string) => void;
  onStep: (id: string, delta: 1 | -1) => void;
  onEditQty: (id: string) => void;
  onEditWeight: (id: string) => void;
  onRemove: (id: string) => void;
}

/** The check as it will be printed: number, product, quantity, price, sum. The selected line unfolds its controls. */
export default function Receipt({ items, selectedId, flashId, money, onSelect, onStep, onEditQty, onEditWeight, onRemove }: ReceiptProps) {
  return (
    <div className="sh-rcpt">
      <div className="sh-g sh-rh">
        <div>№</div>
        <div>Товар</div>
        <div>Кол-во</div>
        <div>Цена</div>
        <div>Сумма</div>
      </div>

      {items.length === 0 ? (
        <div className="sh-empty">
          <ShoppingBasket className="i" />
          <b>Чек пуст</b>
          <small>Отсканируйте первый товар — или откройте «Плитки»</small>
        </div>
      ) : (
        <div className="sh-rl" id="sh-rl">
          {items.map((item, index) => {
            const weighed = Boolean(item.grams && item.weightUnit);
            const selected = item.id === selectedId;
            const lineTotal = Math.round(item.price * item.quantity * 100) / 100;

            const row = (
              <div className="sh-g sh-row" key={item.id} onClick={() => onSelect(item.id)} data-line={item.id}>
                <div className="n tab">{index + 1}</div>
                <div className="nm">
                  <span>
                    {item.name}
                    {item.id === flashId && <span className="sh-new" style={{ display: "inline" }}>только что</span>}
                  </span>
                  {(item.barcode || weighed) && (
                    <div className="bc tab">{weighed ? "весовой" : item.barcode}</div>
                  )}
                </div>
                {weighed ? (
                  <div className="q kg tab">
                    <Scale className="i" />
                    {formatKg(item.grams!)} кг
                  </div>
                ) : (
                  <div className="q tab">{item.quantity} шт</div>
                )}
                <div className="p tab">
                  {weighed ? (
                    <>
                      {money(pricePerKg(item.rate ?? 0, item.weightUnit!))} <small>/ кг</small>
                    </>
                  ) : (
                    money(item.price)
                  )}
                </div>
                <div className="s tab">{money(lineTotal)}</div>
              </div>
            );

            if (!selected) return row;
            return (
              <div className={`sh-sel${item.id === flashId ? " sh-flash" : ""}`} key={item.id}>
                {row}
                <div className="sh-ctl">
                  {weighed ? (
                    <button className="sh-cb" onClick={() => onEditWeight(item.id)}>
                      <Scale className="i" />
                      Изменить вес
                    </button>
                  ) : (
                    <div className="sh-step">
                      <button onClick={() => onStep(item.id, -1)} aria-label="Меньше">
                        <Minus className="i" />
                      </button>
                      <button className="v tab" onClick={() => onEditQty(item.id)} title="Ввести количество">
                        {item.quantity}
                      </button>
                      <button onClick={() => onStep(item.id, 1)} aria-label="Больше">
                        <Plus className="i" />
                      </button>
                    </div>
                  )}
                  <div style={{ flex: 1 }} />
                  <button className="sh-cb del" onClick={() => onRemove(item.id)}>
                    <Trash2 className="i" />
                    Убрать позицию
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
