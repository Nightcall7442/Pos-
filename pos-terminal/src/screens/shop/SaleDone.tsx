import { useEffect, useState } from "react";
import { Check, Printer, ScanBarcode } from "lucide-react";
import toast from "react-hot-toast";
import { useMoney } from "../../hooks/useMoney";
import { printReceipt } from "../../utils/printReceipt";
import type { SaleResult } from "./ShopPayment";

const LABEL = { cash: "наличные", card: "карта", qr: "QR" } as const;

interface SaleDoneProps {
  result: SaleResult;
  /** `carry` is the first character of the next scan, if that is what closed the window. */
  onNext: (carry?: string) => void;
}

/**
 * Shown after every sale. For cash the change is the biggest thing on screen —
 * it is what the cashier needs next. The next barcode scan (or Enter) closes
 * the window and starts the next check without touching the screen.
 */
export default function SaleDone({ result, onNext }: SaleDoneProps) {
  const { money, parts } = useMoney();
  const [printing, setPrinting] = useState(false);

  const print = async () => {
    setPrinting(true);
    try {
      await printReceipt(result.order.id);
      toast.success("Чек отправлен на печать", { duration: 1500 });
    } catch {
      toast.error("Не удалось напечатать чек");
    } finally {
      setPrinting(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        e.preventDefault();
        onNext();
      } else if (e.key.length === 1) {
        // A scanner has already started the next barcode.
        e.preventDefault();
        onNext(e.key);
      } else return;
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onNext]);

  const changeParts = parts(result.change);

  return (
    <div className="sh-scrim">
      <div className="sh-modal narrow" role="dialog" aria-label="Оплачено">
        <div className="sh-done">
          <div className="ok">
            <Check className="i" />
          </div>
          <h3>Оплачено</h3>
          <div className="sub tab">
            Чек № {result.order.orderNumber} · {LABEL[result.method]} · {money(result.total)}
          </div>

          {result.method === "cash" && result.change > 0 && (
            <div className="chg">
              <div className="lbl">Сдача</div>
              <div className="v tab">
                {changeParts.figure}
                <small>{changeParts.symbol}</small>
              </div>
            </div>
          )}

          <div className="actions">
            <button className="ghost" onClick={print} disabled={printing}>
              <Printer className="i" />
              Печать
            </button>
            <button className="next" onClick={() => onNext()} autoFocus>
              <ScanBarcode className="i" />
              Новый чек
            </button>
          </div>
          <div className="hint">Следующий отсканированный товар начнёт новый чек</div>
        </div>
      </div>
    </div>
  );
}
