import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Save, ChefHat, Plus, ExternalLink } from "lucide-react";
import { useProduct, useCreateProduct, useUpdateProduct, useCategories, useIngredients } from "../hooks/useProducts";
import { useTechCards } from "../hooks/useTechCards";
import { settingsService } from "../services";
import LoadingSpinner from "../components/LoadingSpinner";
import { useMoney } from "../hooks/useMoney";

export default function ProductEdit() {
  const { money } = useMoney();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const { data: product, isLoading } = useProduct(id || "");
  const { data: categories } = useCategories();
  const { data: ingredients } = useIngredients();
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: () => settingsService.get().then((r) => r.data.data) });
  const { data: techCardsData } = useTechCards({ limit: 100 });
  const techCardsList = techCardsData || [];

  let units = [{ key: "piece", label: "Штука" }];
  let defaultUnit = "piece";
  try {
    const parsed = JSON.parse(settings?.settings || "{}");
    if (parsed.units && Array.isArray(parsed.units) && parsed.units.length > 0) {
      units = parsed.units;
    }
    if (parsed.defaultUnit) {
      defaultUnit = parsed.defaultUnit;
    }
  } catch {}
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const defaultUnitRef = useState(defaultUnit);
  const stableDefaultUnit = defaultUnitRef[0];

  const [form, setForm] = useState({
    name: "", description: "", volume: "", volumeType: "liter" as "liter" | "gram",
    sku: "", barcode: "", price: 0, costPrice: 0,
    compareAtPrice: 0, taxRate: 0, unit: "piece",
    purchaseUnit: "", saleUnit: "", conversionFactor: undefined as number | undefined,
    purchaseCost: 0,
    minStock: 0, currentStock: 0,
    trackInventory: false, categoryId: "", imageUrl: "", isActive: true,
    isIngredient: false,
    techCardId: "" as string,
    preparationArea: "",
    cookingMethod: "",
    noDiscounts: false,
  });

  const getConversionFactor = (purchase: string, sale: string): number | undefined => {
    const conversions: Record<string, Record<string, number>> = {
      "кг": { "г": 1000 },
      "л": { "мл": 1000 },
      "упаковка": { "г": 1000, "мл": 1000 },
    };
    return conversions[purchase]?.[sale];
  };

  const loadedProductIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (product && loadedProductIdRef.current !== product.id) {
      loadedProductIdRef.current = product.id;
      const vol = product.volume || "";
      const isGram = vol.includes("г") || vol.includes("g");
      const purchaseUnit = (product as any).purchaseUnit || "";
      const saleUnit = (product as any).saleUnit || "";
      const conversionFactor = (product as any).conversionFactor;
      const costPrice = Number(product.costPrice) || 0;
      const purchaseCost = conversionFactor ? costPrice * conversionFactor : 0;
      setForm({
        name: product.name || "", description: product.description || "", volume: vol,
        volumeType: isGram ? "gram" : "liter",
        sku: product.sku || "", barcode: product.barcode || "", price: Number(product.price) || 0, costPrice,
        compareAtPrice: Number(product.compareAtPrice) || 0, taxRate: Number(product.taxRate) || 0,
        unit: product.unit || "piece",
        purchaseUnit,
        saleUnit,
        conversionFactor,
        purchaseCost,
        minStock: product.minStock || 0, currentStock: product.currentStock || 0,
        trackInventory: product.trackInventory || false, categoryId: product.categoryId || "",
        imageUrl: product.imageUrl || "", isActive: product.isActive ?? true,
        isIngredient: (product as any).isIngredient || false,
        techCardId: (product as any).techCardId || "",
        preparationArea: (product as any).preparationArea || "",
        cookingMethod: (product as any).cookingMethod || "",
        noDiscounts: (product as any).noDiscounts || false,
      });
    }
  }, [product]);

  const settingsLoadedRef = useRef(false);
  useEffect(() => {
    if (isNew && settings && !settingsLoadedRef.current) {
      settingsLoadedRef.current = true;
      setForm((prev) => ({ ...prev, unit: stableDefaultUnit }));
    }
  }, [isNew, settings, stableDefaultUnit]);

  if (!isNew && isLoading) return <LoadingSpinner />;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { purchaseCost, volumeType, ...submitForm } = form;
    const submitData: any = {
      ...submitForm,
      techCardId: form.techCardId || null,
    };
    if (isNew) {
      createProduct.mutate(submitData, { onSuccess: () => navigate("/products") });
    } else {
      updateProduct.mutate({ id: id!, data: submitData }, { onSuccess: () => navigate("/products") });
    }
  };

  const isPending = createProduct.isPending || updateProduct.isPending;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate("/products")} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><ArrowLeft className="h-5 w-5" /></button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isNew ? "Новый товар" : "Редактирование товара"}</h1>
          <p className="text-gray-500">{isNew ? "Создайте новый товар" : "Обновите данные товара"}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Основная информация</h2>
          <div>
            <label className="label">Название товара *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Напр., Классический бургер" required />
          </div>
          <div>
            <label className="label">Описание</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input min-h-[80px]" placeholder="Описание товара..." />
          </div>
          <div className="space-y-3">
            <label className="label">Объем / Граммовка</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, volumeType: "liter", volume: "" })}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  form.volumeType === "liter"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Объем
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, volumeType: "gram", volume: "" })}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  form.volumeType === "gram"
                    ? "bg-green-600 text-white shadow-md shadow-green-600/20"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Граммы
              </button>
            </div>
            {form.volumeType === "liter" ? (
              <select value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })} className="input">
                <option value="">Без объема</option>
                <option value="0.5 л">0.5 л</option>
                <option value="0.7 л">0.7 л</option>
                <option value="1 л">1 л</option>
                <option value="1.5 л">1.5 л</option>
                <option value="2 л">2 л</option>
              </select>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={form.volume}
                  onChange={(e) => setForm({ ...form, volume: e.target.value })}
                  className="input"
                  placeholder="Введите граммовку..."
                />
                <div className="flex flex-wrap gap-2">
                  {["30 г", "50 г", "100 г", "200 г", "500 г", "1 кг"].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setForm({ ...form, volume: g })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        form.volume === g
                          ? "bg-green-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Категория</label>
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="input">
                <option value="">Без категории</option>
                {categories?.map((cat: any) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Цех приготовления</label>
              <select value={form.preparationArea} onChange={(e) => setForm({ ...form, preparationArea: e.target.value })} className="input">
                <option value="">Не указан</option>
                <option value="Кухня">Кухня</option>
                <option value="Бар">Бар</option>
                <option value="Гриль">Гриль</option>
                <option value="Кондитерская">Кондитерская</option>
                <option value="Холодный цех">Холодный цех</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Метод приготовления</label>
              <select value={form.cookingMethod} onChange={(e) => setForm({ ...form, cookingMethod: e.target.value })} className="input">
                <option value="">Не указан</option>
                <option value="Итальянская кофемашина">Итальянская кофемашина</option>
                <option value="Френч-пресс">Френч-пресс</option>
                <option value="Варка">Варка</option>
                <option value="Жарка">Жарка</option>
                <option value="Запекание">Запекание</option>
                <option value="Гриль">Гриль</option>
                <option value="Пароварка">Пароварка</option>
                <option value="Сборка">Сборка</option>
              </select>
              <p className="text-[10px] text-gray-500 mt-1">Определяет приоритет печати на чеке (1, 2, 3...)</p>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-3 pb-1">
                <input type="checkbox" checked={form.noDiscounts} onChange={(e) => setForm({ ...form, noDiscounts: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
                <span className="text-sm font-medium text-gray-700">Не участвует в скидках</span>
              </label>
            </div>
          </div>
          {form.categoryId && (
            <div className="card space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700">Единицы измерения</h3>
              <p className="text-xs text-gray-500">Укажите как товар закупается и продаётся</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label text-xs">Закупка</label>
                  <select value={form.purchaseUnit || ""} onChange={(e) => setForm({ ...form, purchaseUnit: e.target.value })} className="input text-sm">
                    <option value="">Штука</option>
                    <option value="кг">Кг</option>
                    <option value="л">Литр</option>
                    <option value="упаковка">Упаковка</option>
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Продажа</label>
                  <select value={form.saleUnit || ""} onChange={(e) => setForm({ ...form, saleUnit: e.target.value })} className="input text-sm">
                    <option value="">Штука</option>
                    <option value="г">Грамм</option>
                    <option value="мл">Мл</option>
                    <option value="portion">Порция</option>
                  </select>
                </div>
                {form.purchaseUnit && form.saleUnit && form.purchaseUnit !== form.saleUnit && (
                  <div>
                    <label className="label text-xs">Себестоимость закупки</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.purchaseCost || ""}
                      onChange={(e) => {
                        const purchaseCost = parseFloat(e.target.value) || 0;
                        const factor = getConversionFactor(form.purchaseUnit, form.saleUnit);
                        setForm({
                          ...form,
                          purchaseCost,
                          costPrice: factor ? purchaseCost / factor : 0,
                        });
                      }}
                      className="input text-sm"
                      placeholder="Стоимость партии"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Общая стоимость закупки</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Цены</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Цена продажи за {form.saleUnit || "шт"} *</label>
              <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} className="input" required />
            </div>
            <div>
              <label className="label">Себестоимость за {form.saleUnit || "шт"}</label>
              {form.purchaseUnit && form.saleUnit && form.purchaseUnit !== form.saleUnit ? (
                <input type="text" readOnly value={`${money(form.costPrice)} (авто)`} className="input bg-gray-100 text-gray-600 cursor-not-allowed" />
              ) : (
                <input type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: parseFloat(e.target.value) || 0 })} className="input" />
              )}
            </div>
            <div>
              <label className="label">Моржа за {form.saleUnit || "шт"}</label>
              <input type="text" readOnly value={`${money(form.price - form.costPrice)} (${form.costPrice > 0 ? Math.round(((form.price - form.costPrice) / form.costPrice) * 100) : 0}%)`} className="input bg-gray-50 text-gray-700 cursor-not-allowed" />
            </div>
          </div>
          <div>
            <label className="label">Налог (%)</label>
            <input type="number" step="0.01" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: parseFloat(e.target.value) || 0 })} className="input w-32" />
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Склад</h2>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.trackInventory} onChange={(e) => setForm({ ...form, trackInventory: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
            <span className="text-sm font-medium text-gray-700">Учитывать остатки</span>
          </label>
          {form.trackInventory && (
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Текущий остаток</label><input type="number" value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: parseInt(e.target.value) || 0 })} className="input" /></div>
              <div><label className="label">Минимальный остаток</label><input type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: parseInt(e.target.value) || 0 })} className="input" /></div>
            </div>
          )}
        </div>

        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-orange-500" />
              <h2 className="text-lg font-semibold text-gray-900">Тех карта (рецептура)</h2>
            </div>
            <button
              type="button"
              onClick={() => navigate("/tech-cards?create=true")}
              className="flex items-center gap-1 rounded-lg bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-600 hover:bg-orange-100"
            >
              <Plus className="h-4 w-4" />
              Создать техкарту
            </button>
          </div>
          <p className="text-sm text-gray-500">Выберите техкарту для товара. При оплате заказа остатки ингредиентов спишутся автоматически.</p>

          <div>
            <label className="label">Тех карта</label>
            <select
              value={form.techCardId}
              onChange={(e) => setForm({ ...form, techCardId: e.target.value })}
              className="input"
            >
              <option value="">Без техкарты</option>
              {techCardsList.map((tc: any) => (
                <option key={tc.id} value={tc.id}>{tc.name}</option>
              ))}
            </select>
          </div>

          {form.techCardId && (() => {
            const selected = techCardsList.find((tc: any) => tc.id === form.techCardId);
            if (!selected) return null;
            let ingredients: any[] = [];
            try { ingredients = JSON.parse(selected.ingredients || "[]"); } catch {}
            const markup = form.price > 0 && selected.totalCost > 0
              ? Math.round(((form.price - selected.totalCost) / selected.totalCost) * 100)
              : 0;

            return (
              <div className="rounded-lg bg-orange-50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-orange-800">{selected.name}</p>
                  <button
                    type="button"
                    onClick={() => navigate(`/tech-cards`)}
                    className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800"
                  >
                    Открыть <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">Ингредиентов</p>
                    <p className="font-semibold text-gray-900">{ingredients.length}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Себестоимость</p>
                    <p className="font-semibold text-gray-900">{selected.totalCost.toLocaleString("ru-RU")} СУМ</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Выход</p>
                    <p className="font-semibold text-gray-900">{selected.output} {selected.unit}</p>
                  </div>
                </div>
                {form.price > 0 && (
                  <div className="pt-2 border-t border-orange-200 flex justify-between text-xs">
                    <span className="text-gray-600">Цена: <span className="font-semibold text-gray-900">{form.price.toLocaleString("ru-RU")} СУМ</span></span>
                    <span className="text-gray-600">Маржа: <span className="font-semibold text-green-600">{(form.price - selected.totalCost).toLocaleString("ru-RU")} СУМ ({markup}%)</span></span>
                  </div>
                )}
              </div>
            );
          })()}

          {!form.techCardId && (
            <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
              <ChefHat className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">Тех карта не выбрана</p>
              <p className="text-xs text-gray-400">Выберите техкарту или создайте новую</p>
            </div>
          )}
        </div>

        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Идентификация</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Артикул (SKU)</label><input type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="input" placeholder="Артикул товара" /></div>
            <div><label className="label">Штрихкод</label><input type="text" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="input" placeholder="Штрихкод" /></div>
          </div>
          <div><label className="label">URL изображения</label><input type="url" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className="input" placeholder="https://..." /></div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => navigate("/products")} className="btn-secondary">Отмена</button>
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? "Сохранение..." : <><Save className="mr-2 h-4 w-4" />{isNew ? "Создать товар" : "Сохранить"}</>}
          </button>
        </div>
      </form>
    </div>
  );
}
