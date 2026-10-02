import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { categoryService } from "../services";
import LoadingSpinner from "../components/LoadingSpinner";
import Modal from "../components/Modal";
import toast from "react-hot-toast";
import { Plus, Edit, Trash2, Tags } from "lucide-react";
import EmptyState from "../components/EmptyState";
import Checkbox from "../components/Checkbox";
import { readableOn } from "../utils/contrast";
import { useIsRetail } from "../hooks/useSettings";
import type { Category } from "../services";

interface CategoryForm {
  name: string;
  description: string;
  color: string;
  imageUrl?: string;
  isIngredient: boolean;
  markupPercent: number;
}

// Цвет категории — данные (хранится в базе и уходит на кассу), поэтому hex, а не токен. По умолчанию — сталь.
const DEFAULT_CATEGORY_COLOR = "#62799a";

const defaultForm: CategoryForm = { name: "", description: "", color: DEFAULT_CATEGORY_COLOR, imageUrl: "", isIngredient: false, markupPercent: 0 };

export default function Categories() {
  const retail = useIsRetail();
  const [showCreate, setShowCreate] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(defaultForm);
  const qc = useQueryClient();

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => categoryService.list().then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: CategoryForm) => categoryService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      setShowCreate(false);
      setForm(defaultForm);
      toast.success("Категория создана");
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || "Ошибка");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CategoryForm }) => categoryService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      setEditCat(null);
      toast.success("Категория обновлена");
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || "Ошибка");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoryService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Категория удалена");
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || "Ошибка");
    },
  });

  const openEdit = (cat: Category): void => {
    setEditCat(cat);
    setForm({
      name: cat.name,
      description: cat.description || "",
      color: cat.color || DEFAULT_CATEGORY_COLOR,
      imageUrl: cat.imageUrl || "",
      isIngredient: cat.isIngredient || false,
      markupPercent: Number(cat.markupPercent) || 0,
    });
  };

  const handleCreate = (e: React.FormEvent): void => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  const handleUpdate = (e: React.FormEvent): void => {
    e.preventDefault();
    if (editCat) updateMutation.mutate({ id: editCat.id, data: form });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Категории</h1>
          <p className="text-gray-500">Организация товаров</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Добавить
        </button>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : !categories?.length ? (
        <div className="card">
          <EmptyState
            compact
            icon={<Tags className="h-6 w-6" />}
            title="Категорий пока нет"
            description={
              retail
                ? "Категории — это полки магазина: по ним касса раскладывает плитки товаров без штрихкода, а отчёты — продажи."
                : "Категории — это разделы меню: на кассе они станут рядом клавиш над блюдами."
            }
            action={
              <button onClick={() => setShowCreate(true)} className="btn-primary">
                <Plus className="mr-2 h-4 w-4" />
                Добавить категорию
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories?.map((cat) => (
            // Щелчок по карточке — короткий путь для мыши; с клавиатуры — кнопка «Изменить» внутри.
            <div key={cat.id} role="presentation" className="card group relative cursor-pointer hover:shadow-md transition-shadow" onClick={() => openEdit(cat)}>
              <div className="flex items-start gap-3">
                {cat.imageUrl ? (
                  <img
                    src={cat.imageUrl}
                    alt={cat.name}
                    className="h-12 w-12 rounded-md flex-shrink-0 object-cover"
                  />
                ) : (
                  <div
                    className="h-12 w-12 rounded-md flex-shrink-0 flex items-center justify-center font-bold text-xl"
                    // Цвет выбирает пользователь — подпись белая или графитовая, смотря что читается.
                    style={{ backgroundColor: cat.color || "var(--gray-200)", color: readableOn(cat.color) }}
                  >
                    {cat.name.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{cat.name}</h3>
                    {cat.isIngredient && (
                      <span className="rounded-full bg-warning-100 px-2 py-0.5 text-[10px] font-medium text-warning-700">Ингредиенты</span>
                    )}
                  </div>
                  {cat.description && (
                    <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">{cat.description}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    {cat._count?.products || 0} товаров · наценка {Number(cat.markupPercent) || 0}%
                  </p>
                </div>
              </div>
              {/* Кнопки видны при наведении, при фокусе с клавиатуры и всегда — на сенсорном экране. */}
              <div className="absolute right-2 top-2 flex gap-1 transition-opacity group-focus-within:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
                <button
                  onClick={(e) => { e.stopPropagation(); openEdit(cat); }}
                  aria-label={`Изменить категорию «${cat.name}»`}
                  className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-600"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); if (confirm("Удалить категорию?")) deleteMutation.mutate(cat.id); }}
                  aria-label={`Удалить категорию «${cat.name}»`}
                  className="rounded p-1 text-gray-500 hover:bg-danger-50 hover:text-danger-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Добавить категорию">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label htmlFor="categories-f1" className="label">Название</label>
            <input id="categories-f1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label htmlFor="categories-f2" className="label">Описание</label>
            <input id="categories-f2"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="categories-f3" className="label">URL изображения</label>
            <input id="categories-f3"
              value={form.imageUrl || ""}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              className="input"
              placeholder="https://..."
            />
          </div>
          <div>
            <label htmlFor="categories-f4" className="label">Цвет</label>
            <div className="flex items-center gap-3">
              <input id="categories-f4"
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-10 w-10 rounded-lg border cursor-pointer"
              />
              <span className="text-sm text-gray-500">{form.color}</span>
            </div>
          </div>
          <div>
            <label htmlFor="categories-f5" className="label">Наценка, %</label>
            <input id="categories-f5"
              type="number"
              step="0.1"
              min="0"
              value={form.markupPercent}
              onChange={(e) => setForm({ ...form, markupPercent: parseFloat(e.target.value) || 0 })}
              className="input"
            />
            <p className="mt-1 text-xs text-gray-500">Цена продажи = цена прихода × (1 + наценка / 100). Применяется автоматически при приходе товара.</p>
          </div>
          <Checkbox
            label="Тип: Ингредиенты"
            description="Товары в этой категории не будут показываться в терминале"
            checked={form.isIngredient}
            onChange={(e) => setForm({ ...form, isIngredient: e.target.checked })}
          />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Отмена</button>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary">
              {createMutation.isPending ? "Создание..." : "Создать"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!editCat} onClose={() => setEditCat(null)} title="Редактировать категорию">
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label htmlFor="categories-f6" className="label">Название</label>
            <input id="categories-f6"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label htmlFor="categories-f7" className="label">Описание</label>
            <input id="categories-f7"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="categories-f8" className="label">URL изображения</label>
            <input id="categories-f8"
              value={form.imageUrl || ""}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              className="input"
              placeholder="https://..."
            />
          </div>
          <div>
            <label htmlFor="categories-f9" className="label">Цвет</label>
            <div className="flex items-center gap-3">
              <input id="categories-f9"
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-10 w-10 rounded-lg border cursor-pointer"
              />
              <span className="text-sm text-gray-500">{form.color}</span>
            </div>
          </div>
          <div>
            <label htmlFor="categories-f10" className="label">Наценка, %</label>
            <input id="categories-f10"
              type="number"
              step="0.1"
              min="0"
              value={form.markupPercent}
              onChange={(e) => setForm({ ...form, markupPercent: parseFloat(e.target.value) || 0 })}
              className="input"
            />
            <p className="mt-1 text-xs text-gray-500">Цена продажи = цена прихода × (1 + наценка / 100). Применяется автоматически при приходе товара.</p>
          </div>
          <Checkbox
            label="Тип: Ингредиенты"
            description="Товары в этой категории не будут показываться в терминале"
            checked={form.isIngredient}
            onChange={(e) => setForm({ ...form, isIngredient: e.target.checked })}
          />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setEditCat(null)} className="btn-secondary">Отмена</button>
            <button type="submit" disabled={updateMutation.isPending} className="btn-primary">
              {updateMutation.isPending ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
