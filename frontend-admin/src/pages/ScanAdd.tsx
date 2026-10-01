import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ScanBarcode } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import { catalogService, type CatalogHit, type Product } from "../services";
import { useCategories } from "../hooks/useProducts";
import { useBurstGuard } from "../hooks/useBurstGuard";
import { fetchNational } from "../utils/national";
import { useMoney } from "../hooks/useMoney";
import LoadingSpinner from "../components/LoadingSpinner";

type Step =
  | { kind: "idle" }
  | { kind: "checking"; code: string }
  | { kind: "exists"; code: string; product: Product }
  | { kind: "form"; code: string; hit: CatalogHit | null; valid: boolean };

interface Added {
  id: string;
  name: string;
  barcode: string;
  price: number;
  weighed: boolean;
}

const SOURCE_NOTE: Record<CatalogHit["source"], string> = {
  snapshot: "Нашли в общей базе: название, объём и полка подставлены — осталось ввести цену.",
  off: "Нашли в открытой базе Open Food Facts: название, объём и полка подставлены — осталось ввести цену.",
  tasnif: "Нашли в национальном каталоге товаров Узбекистана: название, объём, полка и код ИКПУ подставлены — осталось ввести цену.",
  crowd: "Это название внесли другие магазины — проверьте его и введите цену.",
};

const toNumber = (text: string): number => Number(text.replace(",", ".")) || 0;

/**
 * Stocking a shop by scanning: the scanner reads a barcode, the shared catalogue
 * supplies the name, size and shelf, and all that is left to type is the price.
 * Scan, price, Enter — next. A few hundred items are an afternoon, not a week.
 */
export default function ScanAdd() {
  const { symbol, money } = useMoney();
  const qc = useQueryClient();
  const { data: categories } = useCategories();
  const { data: stats } = useQuery({ queryKey: ["catalog-stats"], queryFn: () => catalogService.stats().then((r) => r.data.data), staleTime: 10 * 60_000 });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: () => api.get("/settings").then((r) => r.data.data), staleTime: 5 * 60_000 });

  const scanRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [added, setAdded] = useState<Added[]>([]);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [weighed, setWeighed] = useState(false);
  const [shelf, setShelf] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const guard = useBurstGuard(() => toast.error("В поле попал штрихкод — он не принят. Сначала добавьте или пропустите этот товар"));

  const shelves = useMemo(() => (categories ?? []).filter((c) => !c.isIngredient).sort((a, b) => a.name.localeCompare(b.name, "ru")), [categories]);
  const suggestion = step.kind === "form" ? step.hit?.category ?? null : null;
  const matching = suggestion ? shelves.find((c) => c.name.trim().toLowerCase() === suggestion.toLowerCase()) : undefined;
  const chosenShelf = shelf ?? (matching ? `id:${matching.id}` : suggestion ? `new:${suggestion}` : "none");

  useEffect(() => {
    if (step.kind === "idle") scanRef.current?.focus();
  }, [step.kind]);

  const reset = () => {
    setStep({ kind: "idle" });
    setCode("");
  };

  const scan = async (raw: string) => {
    const digits = raw.replace(/\s+/g, "");
    if (!digits) return;
    if (!/^\d{4,14}$/.test(digits)) {
      toast.error("Штрихкод состоит только из цифр");
      return;
    }
    setStep({ kind: "checking", code: digits });
    try {
      // The shop's own catalogue first: nothing is added twice.
      const own = await api
        .get("/products/lookup", { params: { code: digits } })
        .then((r) => r.data.data as Product)
        .catch((error) => {
          if (error?.response?.status === 404) return null;
          throw error;
        });
      if (own) {
        setStep({ kind: "exists", code: digits, product: own });
        return;
      }
      // This browser asks the national catalogue of Uzbekistan itself — the server may not get through.
      const answer = (await catalogService.lookup(digits, await fetchNational(digits))).data.data;
      const hit = answer.found ? answer : null;
      setName(hit?.displayName ?? "");
      setPrice("");
      setStock("");
      setWeighed(false);
      setShelf(null);
      setStep({ kind: "form", code: digits, hit, valid: answer.found || answer.valid });
    } catch {
      toast.error("Не удалось проверить штрихкод — проверьте соединение");
      setStep({ kind: "idle" });
    }
  };

  const priceValue = toNumber(price);
  const stockValue = stock.trim() === "" ? undefined : toNumber(stock);
  const canSave = step.kind === "form" && name.trim().length > 0 && priceValue > 0 && priceValue <= 99_999_999 && (stockValue === undefined || stockValue >= 0);

  const save = async () => {
    if (step.kind !== "form" || !canSave || saving || guard.locked()) return;
    setSaving(true);
    try {
      const product = (
        await catalogService.add({
          barcode: step.code,
          name: name.trim(),
          price: priceValue,
          weighed,
          ...(step.hit?.ikpu ? { ikpu: step.hit.ikpu } : {}),
          ...(stockValue !== undefined ? { stock: stockValue } : {}),
          ...(chosenShelf.startsWith("id:") ? { categoryId: chosenShelf.slice(3) } : chosenShelf.startsWith("new:") ? { categoryName: chosenShelf.slice(4) } : {}),
        })
      ).data.data;
      setAdded((list) => [{ id: product.id, name: product.name, barcode: step.code, price: Number(product.price), weighed }, ...list]);
      toast.success(`Добавлено: ${product.name}`);
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      reset();
    } catch (error) {
      toast.error((error as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Не удалось добавить товар");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link to="/products" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="mr-1 h-4 w-4" />К товарам
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Добавление товаров сканером</h1>
        <p className="text-gray-500">Наведите сканер на штрихкод — название, объём и полку подставит общая база. Вам остаётся ввести цену.</p>
      </div>

      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          void scan(code);
        }}
      >
        <label className="label" htmlFor="scan-code">
          Штрихкод
        </label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              id="scan-code"
              ref={scanRef}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, ""))}
              onKeyDown={(e) => {
                // Some scanners end a code with Tab instead of Enter.
                if (e.key === "Tab" && code.trim().length >= 8) {
                  e.preventDefault();
                  void scan(code);
                }
              }}
              className="input pl-11 font-mono text-lg tracking-wide"
              placeholder="Наведите сканер на штрихкод…"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
            />
          </div>
          <button type="submit" className="btn-primary" disabled={step.kind === "checking" || code.trim() === ""}>
            Найти
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">Сканер сам «набирает» цифры и нажимает Enter. Нет сканера — введите цифры под штрихкодом вручную.</p>
      </form>

      {step.kind === "checking" && (
        <div className="card">
          <LoadingSpinner />
        </div>
      )}

      {step.kind === "exists" && (
        <div className="card flex items-center justify-between gap-4" role="status">
          <div>
            <p className="text-sm text-gray-500">Этот товар уже есть в вашем каталоге</p>
            <p className="text-lg font-semibold text-gray-900">{step.product.name}</p>
            <p className="text-sm text-gray-600">{money(step.product.price)}</p>
          </div>
          <div className="flex gap-2">
            <Link to={`/products/${step.product.id}`} className="btn-secondary">
              Открыть
            </Link>
            <button type="button" className="btn-primary" onClick={reset}>
              Дальше
            </button>
          </div>
        </div>
      )}

      {step.kind === "form" && (
        <form
          className="card space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") reset();
          }}
        >
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Новый товар</h2>
            <span className="font-mono text-sm text-gray-400">{step.code}</span>
          </div>

          <p
            className={`rounded-lg px-3 py-2 text-sm ${
              step.hit ? "bg-green-50 text-green-800" : step.valid ? "bg-amber-50 text-amber-800" : "bg-gray-100 text-gray-600"
            }`}
          >
            {step.hit
              ? SOURCE_NOTE[step.hit.source]
              : step.valid
                ? `Этого штрихкода нет в общей базе. Введите название${settings?.catalogSharing !== false ? " — оно попадёт в базу и поможет другим магазинам" : ""}.`
                : "Штрихкод не похож на заводской (внутренний код или опечатка) — товар добавится только в ваш магазин."}
          </p>

          {step.hit?.ikpu && (
            <p className="-mt-1 text-xs text-gray-500">
              Код ИКПУ для счёта-фактуры и чека: <span className="font-mono text-gray-700">{step.hit.ikpu}</span>
            </p>
          )}

          <div>
            <label className="label">Название *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" maxLength={160} autoFocus={!step.hit} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{weighed ? `Цена за кг, ${symbol}` : `Цена, ${symbol}`} *</label>
              <input
                value={price}
                onChange={(e) => {
                  // A code scanned into this field by mistake is refused, not saved as a price.
                  const kept = guard.accept(price, e.target.value.replace(/[^\d.,]/g, ""));
                  if (kept !== null) setPrice(kept);
                }}
                className="input"
                inputMode="decimal"
                maxLength={10}
                placeholder="0"
                autoFocus={Boolean(step.hit)}
              />
            </div>
            <div>
              <label className="label">
                Остаток{weighed ? ", кг" : ""} <span className="font-normal text-gray-400">(необязательно)</span>
              </label>
              <input
                value={stock}
                onChange={(e) => {
                  const kept = guard.accept(stock, e.target.value.replace(/[^\d.,]/g, ""));
                  if (kept !== null) setStock(kept);
                }}
                className="input"
                inputMode="decimal"
                maxLength={9}
                placeholder="не считать остаток"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Полка (категория)</label>
              <select value={chosenShelf} onChange={(e) => setShelf(e.target.value)} className="input">
                <option value="none">Без полки</option>
                {shelves.map((c) => (
                  <option key={c.id} value={`id:${c.id}`}>
                    {c.name}
                  </option>
                ))}
                {suggestion && !matching && <option value={`new:${suggestion}`}>{suggestion} (новая)</option>}
              </select>
            </div>
            <div>
              <label className="label">Продаётся</label>
              <div className="flex overflow-hidden rounded-lg border border-gray-200">
                {([false, true] as const).map((byWeight) => (
                  <button
                    key={String(byWeight)}
                    type="button"
                    onClick={() => setWeighed(byWeight)}
                    className={`flex-1 px-3 py-2 text-sm font-medium ${weighed === byWeight ? "bg-primary-50 text-primary-700" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                  >
                    {byWeight ? "на вес" : "поштучно"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <span className="mr-auto text-xs text-gray-400">Enter — добавить, Esc — пропустить</span>
            <button type="button" className="btn-secondary" onClick={reset}>
              Пропустить
            </button>
            <button type="submit" className="btn-primary" disabled={!canSave || saving}>
              <Check className="mr-2 h-4 w-4" />
              {saving ? "Добавляю…" : "Добавить товар"}
            </button>
          </div>
        </form>
      )}

      {added.length > 0 && (
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Добавлено за этот раз: {added.length}
          </h2>
          <ul className="divide-y divide-gray-100">
            {added.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 py-2">
                <div className="min-w-0">
                  <Link to={`/products/${item.id}`} className="block truncate text-sm font-medium text-gray-900 hover:text-primary-600">
                    {item.name}
                  </Link>
                  <span className="font-mono text-xs text-gray-400">{item.barcode}</span>
                </div>
                <span className="whitespace-nowrap text-sm font-medium text-gray-700">
                  {money(item.price)}
                  {item.weighed ? " / кг" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs leading-relaxed text-gray-400">
        {stats ? `Товаров в общей базе: ${stats.total.toLocaleString("ru-RU")}. ` : ""}
        Данные о товарах — национальный каталог товаров Узбекистана (tasnif.soliq.uz, Налоговый комитет), Open Food Facts, Open Beauty Facts, Open Products Facts (© участники проектов, лицензия ODbL) и магазины Qwik. Название из базы — подсказка: проверьте его перед добавлением.
      </p>
    </div>
  );
}
