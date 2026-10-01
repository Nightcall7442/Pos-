import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import type { Category, Product } from "../../types";
import { productEmoji } from "../../utils/emoji";
import { useBurstGuard } from "../../hooks/useBurstGuard";
import { parseDecimal } from "../../utils/weight";
import { useEscape } from "./Modals";

/** What the shared barcode catalogue knows about a code — see GET /catalog/lookup. */
export interface CatalogHit {
  found: true;
  barcode: string;
  name: string;
  brand: string | null;
  quantity: string | null;
  category: string | null;
  displayName: string;
  /** the 17-digit code of the national tax catalogue (tasnif.soliq.uz) — what an invoice and a receipt need */
  ikpu: string | null;
  source: "snapshot" | "off" | "crowd" | "tasnif";
}

interface CatalogAddProps {
  code: string;
  /** null when nobody has described this code yet */
  hit: CatalogHit | null;
  symbol: string;
  onAdded: (product: Product) => void;
  onClose: () => void;
}

const SOURCE_NOTE: Record<CatalogHit["source"], string> = {
  snapshot: "Название взято из общей базы товаров — проверьте и введите цену",
  off: "Название найдено в открытой базе Open Food Facts — проверьте и введите цену",
  tasnif: "Данные из национального каталога товаров Узбекистана — проверьте название и введите цену",
  crowd: "Это название внесли другие магазины — проверьте его и введите цену",
};

/**
 * "This barcode is not in the shop yet": the catalogue has already filled in the
 * name and the shelf, so the manager only types the price (and, if they wish,
 * how much there is) and the product is on the register — and in the check.
 */
export default function CatalogAdd({ code, hit, symbol, onAdded, onClose }: CatalogAddProps) {
  useEscape(onClose);

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get("/categories").then((r) => r.data.data),
    staleTime: 60_000,
  });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: () => api.get("/settings").then((r) => r.data.data), staleTime: 5 * 60_000 });

  const suggestion = hit?.category ?? null;
  const shelves = useMemo(() => (categories ?? []).filter((c) => !c.isIngredient).sort((a, b) => a.name.localeCompare(b.name, "ru")), [categories]);
  // The suggested shelf, if the shop has one of that name — otherwise it is offered as a new one.
  const matching = suggestion ? shelves.find((c) => c.name.trim().toLowerCase() === suggestion.toLowerCase()) : undefined;

  const [name, setName] = useState(hit?.displayName ?? "");
  const [shelf, setShelf] = useState<string | null>(null); // "id:<uuid>" | "new:<name>" | "none" — null until the user picks
  const [weighed, setWeighed] = useState(false);
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [saving, setSaving] = useState(false);
  const guard = useBurstGuard(() => toast.error("В поле попал штрихкод — он не принят. Сначала добавьте или отмените этот товар", { id: "shop-error", duration: 4000 }));

  const chosenShelf = shelf ?? (matching ? `id:${matching.id}` : suggestion ? `new:${suggestion}` : "none");
  const priceValue = parseDecimal(price);
  const stockValue = stock.trim() === "" ? undefined : parseDecimal(stock);
  const valid = name.trim().length > 0 && priceValue > 0 && priceValue <= 99_999_999 && (stockValue === undefined || stockValue >= 0);
  const shareNote = settings?.catalogSharing !== false;

  const submit = async () => {
    if (!valid || saving || guard.locked()) return;
    setSaving(true);
    try {
      const res = await api.post("/catalog/add", {
        barcode: code,
        name: name.trim(),
        price: priceValue,
        weighed,
        ...(stockValue !== undefined ? { stock: stockValue } : {}),
        ...(chosenShelf.startsWith("id:") ? { categoryId: chosenShelf.slice(3) } : chosenShelf.startsWith("new:") ? { categoryName: chosenShelf.slice(4) } : {}),
      });
      onAdded(res.data.data as Product);
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(message ?? "Не удалось добавить товар", { id: "shop-error" });
      setSaving(false);
    }
  };

  return (
    <div className="sh-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="sh-modal narrow"
        role="dialog"
        aria-label="Новый товар"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="sh-mh">
          <div className="emo">{productEmoji(name || hit?.name || "", suggestion ?? "")}</div>
          <div>
            <h3>Новый товар</h3>
            <p className="tab">штрихкод {code}</p>
          </div>
          <button type="button" className="sh-ic" onClick={onClose} aria-label="Закрыть">
            <X className="i" />
          </button>
        </div>

        <p className={`sh-cnote${hit ? "" : " none"}`}>
          {hit ? SOURCE_NOTE[hit.source] : `Этого штрихкода нет в общей базе. Введите название${shareNote ? " — оно попадёт в базу и поможет другим магазинам" : ""}`}
        </p>

        {hit?.ikpu && (
          <p className="sh-cikpu">
            ИКПУ <b className="tab">{hit.ikpu}</b> — код для чека и счёта-фактуры
          </p>
        )}

        <label className="sh-field">
          <span>Название</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={160} autoFocus={!hit} />
        </label>

        <div className="sh-cgrid">
          <label className="sh-field">
            <span>{weighed ? `Цена за кг, ${symbol}` : `Цена, ${symbol}`}</span>
            <input
              value={price}
              onChange={(e) => {
                // A code scanned into this field by mistake is refused, not saved as a price.
                const kept = guard.accept(price, e.target.value.replace(/[^\d.,]/g, ""));
                if (kept !== null) setPrice(kept);
              }}
              inputMode="decimal"
              maxLength={10}
              autoFocus={Boolean(hit)}
              placeholder="0"
            />
          </label>
          <label className="sh-field">
            <span>Остаток{weighed ? ", кг" : ""} <em>(необязательно)</em></span>
            <input
              value={stock}
              onChange={(e) => {
                const kept = guard.accept(stock, e.target.value.replace(/[^\d.,]/g, ""));
                if (kept !== null) setStock(kept);
              }}
              inputMode="decimal"
              maxLength={9}
              placeholder="не считать"
            />
          </label>
        </div>

        <div className="sh-cgrid">
          <label className="sh-field">
            <span>Полка</span>
            <select value={chosenShelf} onChange={(e) => setShelf(e.target.value)}>
              <option value="none">Без полки</option>
              {shelves.map((c) => (
                <option key={c.id} value={`id:${c.id}`}>
                  {c.name}
                </option>
              ))}
              {suggestion && !matching && <option value={`new:${suggestion}`}>{suggestion} (новая)</option>}
            </select>
          </label>
          <div className="sh-field">
            <span>Продаётся</span>
            <div className="sh-seg" role="group" aria-label="Как продаётся">
              <button type="button" className={weighed ? "" : "on"} onClick={() => setWeighed(false)}>
                поштучно
              </button>
              <button type="button" className={weighed ? "on" : ""} onClick={() => setWeighed(true)}>
                на вес
              </button>
            </div>
          </div>
        </div>

        <div className="sh-ma">
          <button type="button" className="cancel" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="ok" disabled={!valid || saving}>
            <Check className="i" />
            {saving ? "Добавляю…" : weighed ? "Добавить и взвесить" : "Добавить и продать"}
          </button>
        </div>
      </form>
    </div>
  );
}
