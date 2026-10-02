import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChefHat, Search, Plus, Trash2, Save, X, ChevronRight,
  Copy, Pencil,
} from "lucide-react";
import { productService } from "../services";
import type { TechCard, TechCardItem } from "../services";
import {
  useTechCards, useCreateTechCard, useUpdateTechCard,
  useDeleteTechCard, useCopyTechCard,
} from "../hooks/useTechCards";
import LoadingSpinner from "../components/LoadingSpinner";
import EmptyState from "../components/EmptyState";

export default function TechCards() {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TechCardItem[]>([]);
  const [editName, setEditName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newCard, setNewCard] = useState({ name: "", ingredients: [] as TechCardItem[], output: 0, unit: "г" });

  const { data: techCardsData, isLoading } = useTechCards({ search, limit: 100 });
  const techCards = techCardsData || [];

  const { data: ingredients } = useQuery({
    queryKey: ["ingredients"],
    queryFn: () => productService.getIngredients().then((r) => r.data.data),
  });

  const createMutation = useCreateTechCard();
  const updateMutation = useUpdateTechCard();
  const deleteMutation = useDeleteTechCard();
  const copyMutation = useCopyTechCard();

  const getIngName = (id: string) => ingredients?.find((i) => i.id === id)?.name || "—";
  const getIngCost = (id: string) => ingredients?.find((i) => i.id === id)?.costPrice || 0;
  const calcTotal = (items: TechCardItem[]) =>
    items.reduce((s, i) => s + getIngCost(i.ingredientId) * i.quantity, 0);
  const calcOutput = (items: TechCardItem[]) =>
    items.reduce((s, i) => s + (i.netWeight || i.quantity || 0), 0);

  const startEdit = (tc: TechCard) => {
    let items: TechCardItem[] = [];
    try { items = JSON.parse(tc.ingredients || "[]"); } catch {}
    setEditingId(tc.id);
    setEditName(tc.name);
    setEditForm(items);
    setExpandedId(tc.id);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Удалить техкарту?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleCopy = (id: string) => {
    copyMutation.mutate(id);
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Тех карты</h1>
          <p className="text-gray-500">Рецептуры блюд и расчёт себестоимости</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="mr-2 h-4 w-4" /> Создать техкарту
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input w-full pl-10"
          placeholder="Поиск по названию..."
        />
      </div>

      {/* Tech Cards List */}
      {techCards.length === 0 ? (
        <div className="card">
          {search ? (
            <EmptyState
              compact
              icon={<ChefHat className="h-6 w-6" />}
              title={`По запросу «${search}» техкарт нет`}
              action={<button onClick={() => setSearch("")} className="btn-secondary">Сбросить поиск</button>}
            />
          ) : (
            <EmptyState
              compact
              icon={<ChefHat className="h-6 w-6" />}
              title="Техкарт пока нет"
              description="Техкарта — рецепт блюда: сколько каких ингредиентов уходит на порцию. При продаже они списываются со склада сами."
              action={
                <button onClick={() => setShowCreate(true)} className="btn-primary">
                  <Plus className="mr-2 h-4 w-4" />
                  Создать техкарту
                </button>
              }
            />
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {techCards.map((tc) => {
            let items: TechCardItem[] = [];
            try { items = JSON.parse(tc.ingredients || "[]"); } catch {}
            const isExpanded = expandedId === tc.id;
            const isEditing = editingId === tc.id;
            const totalCost = isEditing ? calcTotal(editForm) : tc.totalCost;
            const output = isEditing ? calcOutput(editForm) : tc.output;

            return (
              <div key={tc.id} className="card overflow-hidden">
                {/* Card Header */}
                {/* Щелчок по шапке — для мыши; с клавиатуры раскрывает кнопка с названием. */}
                <div
                  role="presentation"
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => { if (!isEditing) { setExpandedId(isExpanded ? null : tc.id); setEditingId(null); } }}
                >
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    disabled={isEditing}
                    onClick={(e) => { e.stopPropagation(); if (!isEditing) { setExpandedId(isExpanded ? null : tc.id); setEditingId(null); } }}
                    className="flex items-center gap-3 rounded text-left"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-100">
                      <ChefHat className="h-5 w-5 text-warning-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{tc.name}</p>
                      <p className="text-xs text-gray-500">
                        {items.length} ингред. · Выход: {output} {tc.unit}
                        {!!tc.products?.length && ` · Товаров: ${tc.products.length}`}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {totalCost.toLocaleString("ru-RU")} СУМ
                      </p>
                      <p className="text-xs text-gray-500">Себестоимость</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(tc); }}
                        className="rounded-lg p-2 text-gray-500 hover:bg-warning-50 hover:text-warning-600"
                        title="Редактировать"
                        aria-label={`Редактировать «${tc.name}»`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopy(tc.id); }}
                        className="rounded-lg p-2 text-gray-500 hover:bg-info-50 hover:text-info-600"
                        title="Копировать"
                        aria-label={`Копировать «${tc.name}»`}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(tc.id); }}
                        className="rounded-lg p-2 text-gray-500 hover:bg-danger-50 hover:text-danger-600"
                        title="Удалить"
                        aria-label={`Удалить «${tc.name}»`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <ChevronRight className={`h-5 w-5 text-gray-500 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  </div>
                </div>

                {/* Expanded View */}
                {isExpanded && !isEditing && (
                  <div className="border-t border-gray-100 px-4 pb-4">
                    <div className="overflow-x-auto">
                    <table className="mt-3 w-full text-sm">
                      <thead>
                        <tr className="text-xs font-medium uppercase text-gray-500">
                          <th className="pb-2 text-left">#</th>
                          <th className="pb-2 text-left">Ингредиент</th>
                          <th className="pb-2 text-center">Брутто</th>
                          <th className="pb-2 text-center">Нетто</th>
                          <th className="pb-2 text-center">Ед.</th>
                          <th className="pb-2 text-right">Стоимость</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-2 text-gray-500">{idx + 1}</td>
                            <td className="py-2 font-medium text-gray-900">{getIngName(item.ingredientId)}</td>
                            <td className="py-2 text-center text-gray-600">{item.grossWeight || "—"} {item.unit}</td>
                            <td className="py-2 text-center text-gray-600">{item.netWeight || item.quantity} {item.unit}</td>
                            <td className="py-2 text-center text-gray-600">{item.unit}</td>
                            <td className="py-2 text-right font-medium text-gray-900">
                              {(getIngCost(item.ingredientId) * item.quantity).toLocaleString("ru-RU")} СУМ
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-gray-200">
                          <td colSpan={5} className="pt-2 text-right font-semibold text-gray-700">Итого:</td>
                          <td className="pt-2 text-right font-bold text-warning-600">{totalCost.toLocaleString("ru-RU")} СУМ</td>
                        </tr>
                      </tfoot>
                    </table>
                    </div>
                    {!!tc.products?.length && (
                      <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm">
                        <p className="font-medium text-gray-700 mb-1">Используется в товарах:</p>
                        <div className="flex flex-wrap gap-2">
                          {tc.products?.map((p) => (
                            <span key={p.id} className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-gray-600 border">
                              {p.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Edit Mode */}
                {isEditing && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                    <div>
                      <label htmlFor="techcards-f1" className="label">Название техкарты</label>
                      <input id="techcards-f1"
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="input"
                        placeholder="Название"
                      />
                    </div>
                    <div className="grid grid-cols-[1fr_90px_90px_70px_90px_36px] gap-2 text-xs font-semibold text-gray-500 uppercase">
                      <span>Продукт</span><span className="text-center">Брутто</span><span className="text-center">Нетто</span>
                      <span className="text-center">Ед.</span><span className="text-center">Стоимость</span><span></span>
                    </div>
                    {editForm.map((item, index) => {
                      const ing = ingredients?.find((i) => i.id === item.ingredientId);
                      const lineCost = ing ? ing.costPrice * item.quantity : 0;
                      return (
                        <div key={index} className="grid grid-cols-[1fr_90px_90px_70px_90px_36px] gap-2 items-center rounded-lg bg-gray-50 p-2">
                          <select value={item.ingredientId} onChange={(e) => { const a = [...editForm]; a[index] = { ...item, ingredientId: e.target.value }; setEditForm(a); }} className="input text-sm">
                            <option value="">Выберите ингредиент</option>
                            {ingredients?.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                          </select>
                          <input type="number" step="0.01" min="0" value={item.grossWeight || ""} onChange={(e) => { const a = [...editForm]; a[index] = { ...item, grossWeight: parseFloat(e.target.value) || 0 }; setEditForm(a); }} className="input text-sm text-center" placeholder="0" />
                          <input type="number" step="0.01" min="0" value={item.netWeight || ""} onChange={(e) => { const v = parseFloat(e.target.value) || 0; const a = [...editForm]; a[index] = { ...item, netWeight: v, quantity: v }; setEditForm(a); }} className="input text-sm text-center" placeholder="0" />
                          <select value={item.unit} onChange={(e) => { const a = [...editForm]; a[index] = { ...item, unit: e.target.value }; setEditForm(a); }} className="input text-sm">
                            <option value="г">г</option><option value="мл">мл</option><option value="шт">шт</option><option value="кг">кг</option><option value="л">л</option>
                          </select>
                          <div className="text-sm text-right font-medium text-gray-700">{ing ? lineCost.toLocaleString("ru-RU") : "—"} <span className="text-xs text-gray-500">СУМ</span></div>
                          <button type="button" onClick={() => setEditForm(editForm.filter((_, i) => i !== index))} className="rounded p-1.5 text-danger-400 hover:bg-danger-50 hover:text-danger-600"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      );
                    })}
                    <button type="button" onClick={() => setEditForm([...editForm, { ingredientId: "", quantity: 0, unit: "г", grossWeight: 0, netWeight: 0 }])} className="flex items-center gap-1 rounded-lg bg-warning-50 px-3 py-1.5 text-sm font-medium text-warning-600 hover:bg-warning-100">
                      <Plus className="h-4 w-4" /> Добавить ингредиент
                    </button>
                    {editForm.length > 0 && (() => {
                      const t = calcTotal(editForm);
                      const o = calcOutput(editForm);
                      return (
                        <div className="flex items-center justify-between rounded-lg bg-warning-50 p-3 text-sm text-warning-700">
                          <span>{editForm.length} ингред. · Выход: {o} {tc.unit}</span>
                          <span className="font-semibold">{t.toLocaleString("ru-RU")} СУМ</span>
                        </div>
                      );
                    })()}
                    <div className="flex justify-end gap-2 pt-1">
                      <button onClick={() => { setEditingId(null); setEditForm([]); }} className="btn-secondary flex items-center gap-1"><X className="h-4 w-4" /> Отмена</button>
                      <button
                        onClick={() => updateMutation.mutate({ id: tc.id, data: { name: editName, ingredients: editForm } })}
                        disabled={updateMutation.isPending}
                        className="btn-primary flex items-center gap-1"
                      >
                        <Save className="h-4 w-4" /> {updateMutation.isPending ? "Сохранение..." : "Сохранить"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Новая тех карта</h2>
              <button onClick={() => setShowCreate(false)} className="rounded p-1 text-gray-500 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="techcards-f2" className="label">Название техкарты *</label>
                <input id="techcards-f2"
                  type="text"
                  value={newCard.name}
                  onChange={(e) => setNewCard({ ...newCard, name: e.target.value })}
                  className="input"
                  placeholder="Напр., Классический бургер"
                />
              </div>
              <div>
                <p className="label">Ингредиенты</p>
                {newCard.ingredients.map((item, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <select value={item.ingredientId} onChange={(e) => { const a = [...newCard.ingredients]; a[idx] = { ...item, ingredientId: e.target.value }; setNewCard({ ...newCard, ingredients: a }); }} className="input text-sm flex-1">
                      <option value="">Ингредиент</option>
                      {ingredients?.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                    <input type="number" step="0.01" min="0" value={item.grossWeight || ""} onChange={(e) => { const a = [...newCard.ingredients]; a[idx] = { ...item, grossWeight: parseFloat(e.target.value) || 0 }; setNewCard({ ...newCard, ingredients: a }); }} className="input text-sm w-20" placeholder="Брутто" />
                    <input type="number" step="0.01" min="0" value={item.netWeight || ""} onChange={(e) => { const v = parseFloat(e.target.value) || 0; const a = [...newCard.ingredients]; a[idx] = { ...item, netWeight: v, quantity: v }; setNewCard({ ...newCard, ingredients: a }); }} className="input text-sm w-20" placeholder="Нетто" />
                    <select value={item.unit} onChange={(e) => { const a = [...newCard.ingredients]; a[idx] = { ...item, unit: e.target.value }; setNewCard({ ...newCard, ingredients: a }); }} className="input text-sm w-20">
                      <option value="г">г</option><option value="мл">мл</option><option value="шт">шт</option>
                    </select>
                    <button type="button" onClick={() => setNewCard({ ...newCard, ingredients: newCard.ingredients.filter((_, i) => i !== idx) })} className="rounded p-2 text-danger-400 hover:bg-danger-50"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setNewCard({ ...newCard, ingredients: [...newCard.ingredients, { ingredientId: "", quantity: 0, unit: "г", grossWeight: 0, netWeight: 0 }] })} className="flex items-center gap-1 rounded-lg bg-warning-50 px-3 py-1.5 text-sm font-medium text-warning-600 hover:bg-warning-100 mt-2">
                  <Plus className="h-4 w-4" /> Добавить ингредиент
                </button>
              </div>
              {newCard.ingredients.length > 0 && (() => {
                const t = calcTotal(newCard.ingredients);
                const o = calcOutput(newCard.ingredients);
                return (
                  <div className="flex items-center justify-between rounded-lg bg-warning-50 p-3 text-sm text-warning-700">
                    <span>{newCard.ingredients.length} ингред. · Выход: {o} г</span>
                    <span className="font-semibold">{t.toLocaleString("ru-RU")} СУМ</span>
                  </div>
                );
              })()}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="btn-secondary">Отмена</button>
              <button
                onClick={() => createMutation.mutate({ name: newCard.name, ingredients: newCard.ingredients }, {
                  onSuccess: () => { setShowCreate(false); setNewCard({ name: "", ingredients: [], output: 0, unit: "г" }); },
                })}
                disabled={!newCard.name || createMutation.isPending}
                className="btn-primary"
              >
                {createMutation.isPending ? "Создание..." : "Создать"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
