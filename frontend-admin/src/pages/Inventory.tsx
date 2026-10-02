import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryService } from "../services";
import LoadingSpinner from "../components/LoadingSpinner";
import SearchInput from "../components/SearchInput";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import toast from "react-hot-toast";
import { AlertTriangle, Plus, Minus, Package, Truck } from "lucide-react";
import type { Product, Category } from "../services";
import { useMoney } from "../hooks/useMoney";


interface StockProduct {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  minStock: number;
  costPrice: number;
  price: number;
  imageUrl?: string;
  trackInventory: boolean;
  purchaseUnit?: string | null;
  saleUnit?: string | null;
  conversionFactor?: number | null;
  category?: Category;
}

export default function Inventory() {
  const { money, symbol } = useMoney();
  const [search, setSearch] = useState("");
  const [adjustModal, setAdjustModal] = useState<{ productId: string; productName: string } | null>(null);
  const [adjustType, setAdjustType] = useState<"increase" | "decrease">("increase");
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustCost, setAdjustCost] = useState(0);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["inventory", search],
    queryFn: () => inventoryService.getStock({ search, limit: 50 }).then((r) => r.data),
  });

  const { data: alerts } = useQuery<Product[]>({
    queryKey: ["inventory-alerts"],
    queryFn: () => inventoryService.getAlerts().then((r) => r.data.data),
  });

  const adjustMutation = useMutation({
    mutationFn: (data: { productId: string; quantity: number; reason: string }) =>
      inventoryService.adjustStock(data.productId, { quantity: data.quantity, reason: data.reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["inventory-alerts"] });
      setAdjustModal(null);
      setAdjustQty(0);
      setAdjustReason("");
      setAdjustCost(0);
      toast.success("Остатки обновлены");
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || "Ошибка");
    },
  });

  const products: StockProduct[] = data?.data || [];

  const handleAdjust = (): void => {
    if (!adjustModal || !adjustReason || adjustQty <= 0) return;

    const quantity = adjustType === "decrease" ? -adjustQty : adjustQty;

    adjustMutation.mutate({
      productId: adjustModal.productId,
      quantity,
      reason: adjustReason,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Склад</h1>
        <p className="text-gray-500">Управление остатками товаров</p>
      </div>

      {alerts && alerts.length > 0 && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="font-semibold">Мало на складе ({alerts.length})</h3>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {alerts.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
                {p.name} — {p.currentStock} шт.
              </span>
            ))}
          </div>
        </div>
      )}

      <SearchInput value={search} onChange={setSearch} placeholder="Поиск товаров..." className="w-full sm:w-80" />

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="p-4">Товар</th>
                <th className="p-4">Категория</th>
                <th className="p-4">Ед. изм.</th>
                <th className="p-4 text-right">Остаток</th>
                <th className="p-4 text-right">Себестоимость</th>
                <th className="p-4 text-right">Сумма</th>
                <th className="p-4">Статус</th>
                <th className="p-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((product) => {
                const isLow = product.trackInventory && product.currentStock <= product.minStock;
                const totalValue = product.currentStock * product.costPrice;
                const unitLabel = product.saleUnit || product.purchaseUnit || "шт";
                return (
                  <tr key={product.id} className={`hover:bg-gray-50 ${isLow ? "bg-red-50/50" : ""}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                            <Package className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                        <span className="font-medium text-gray-900">{product.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-gray-500">{product.category?.name || "—"}</td>
                    <td className="p-4 text-sm text-gray-500">{unitLabel}</td>
                    <td className="p-4 text-right">
                      <span className={`font-semibold ${isLow ? "text-red-600" : "text-gray-900"}`}>
                        {product.currentStock}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap text-right text-sm text-gray-500">
                      {money(product.costPrice)}
                      {product.costPrice > 0 && product.price <= product.costPrice && (
                        <span
                          className="ml-2 inline-flex items-center rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-600"
                          title="Цена продажи не выше себестоимости"
                        >
                          без маржи
                        </span>
                      )}
                    </td>
                    <td className="p-4 whitespace-nowrap text-right font-medium text-gray-900">{money(totalValue)}</td>
                    <td className="p-4">
                      <Badge variant={isLow ? "danger" : "success"}>
                        {isLow ? "Мало" : "В наличии"}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setAdjustModal({ productId: product.id, productName: product.name });
                            setAdjustType("increase");
                            setAdjustCost(product.costPrice);
                          }}
                          className="rounded-lg p-1.5 text-green-600 hover:bg-green-50 transition-colors"
                          title="Приход"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setAdjustModal({ productId: product.id, productName: product.name });
                            setAdjustType("decrease");
                          }}
                          className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 transition-colors"
                          title="Расход"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={!!adjustModal} onClose={() => setAdjustModal(null)} title={`${adjustType === "increase" ? "Приход" : "Расход"} — ${adjustModal?.productName}`} size="sm">
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setAdjustType("increase")}
              className={`flex-1 rounded-lg border-2 py-2.5 text-sm font-medium transition-all ${
                adjustType === "increase"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              <Truck className="mr-1 inline h-4 w-4" />
              Приход
            </button>
            <button
              onClick={() => setAdjustType("decrease")}
              className={`flex-1 rounded-lg border-2 py-2.5 text-sm font-medium transition-all ${
                adjustType === "decrease"
                  ? "border-red-500 bg-red-50 text-red-700"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              <Minus className="mr-1 inline h-4 w-4" />
              Расход
            </button>
          </div>

          <div>
            <label className="label">Количество</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={adjustQty || ""}
              onChange={(e) => setAdjustQty(parseFloat(e.target.value) || 0)}
              className="input"
              placeholder="Введите количество"
            />
          </div>

          {adjustType === "increase" && (
            <div>
              <label className="label">Себестоимость партии ({symbol})</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={adjustCost || ""}
                onChange={(e) => setAdjustCost(parseFloat(e.target.value) || 0)}
                className="input"
                placeholder="Общая стоимость закупки"
              />
              {adjustQty > 0 && adjustCost > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  За единицу: {money(adjustCost / adjustQty)}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="label">Причина</label>
            <select
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              className="input"
            >
              <option value="">Выберите причину</option>
              <option value="Поставка">Поставка</option>
              <option value="Списание">Списание</option>
              <option value="Инвентаризация">Инвентаризация</option>
              <option value="Брак">Брак</option>
              <option value="Возврат">Возврат</option>
            </select>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setAdjustModal(null)} className="btn-secondary">Отмена</button>
            <button
              onClick={handleAdjust}
              disabled={!adjustReason || adjustQty <= 0 || adjustMutation.isPending}
              className="btn-primary"
            >
              {adjustMutation.isPending ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
