import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { stockReceiptService, productService } from "../services";
import LoadingSpinner from "../components/LoadingSpinner";
import Modal from "../components/Modal";
import toast from "react-hot-toast";
import { Plus, Trash2, Calendar, Building2, Eye, Search, Truck } from "lucide-react";
import EmptyState from "../components/EmptyState";
import type { Product } from "../services";
import { useMoney } from "../hooks/useMoney";


interface ReceiptItem {
  productId: string;
  productName: string;
  quantity: number;
  costPrice: number;
  totalSum: number;
  lastEdited: "costPrice" | "totalSum" | null;
  /** Current shelf price, for comparison — not sent. */
  currentPrice: number;
  /** New shelf price; empty means "leave it as it is". */
  salePrice: string;
}

interface Receipt {
  id: string;
  supplierName?: string;
  invoiceNumber?: string;
  totalAmount: number;
  notes?: string;
  createdAt: string;
  user?: { firstName: string; lastName: string };
  items: { product: { name: string; sku: string }; quantity: number; costPrice: number; totalCost: number }[];
}

export default function StockReceipts() {
  const { money } = useMoney();
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<Receipt | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: productsData } = useQuery({
    queryKey: ["products-all"],
    queryFn: () => productService.list({ limit: 200, isActive: true }).then((r) => r.data.data),
  });

  const { data: receiptsData, isLoading } = useQuery({
    queryKey: ["stock-receipts"],
    queryFn: () => stockReceiptService.list({ limit: 50 }).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof stockReceiptService.create>[0]) => stockReceiptService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-receipts"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setShowCreate(false);
      resetForm();
      toast.success("Приход оформлен");
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || "Ошибка");
    },
  });

  const products: Product[] = productsData || [];
  const receipts: Receipt[] = receiptsData?.data || [];

  const filteredProducts = searchQuery
    ? products.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.volume && p.volume.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : products;

  const resetForm = () => {
    setSupplierName("");
    setInvoiceNumber("");
    setNotes("");
    setItems([]);
  };

  const handleProductSelect = (product: Product) => {
    const volumeLabel = product.volume ? ` (${product.volume})` : "";
    const costPrice = product.costPrice || 0;
    setItems([...items, {
      productId: product.id,
      productName: product.name + volumeLabel,
      quantity: 1,
      costPrice,
      totalSum: costPrice,
      lastEdited: null,
      currentPrice: Number(product.price) || 0,
      salePrice: "",
    }]);
  };

  const updateItemQty = (index: number, qty: number) => {
    const updated = [...items];
    updated[index].quantity = qty;
    if (updated[index].lastEdited === "costPrice") {
      updated[index].totalSum = qty * updated[index].costPrice;
    } else if (updated[index].lastEdited === "totalSum") {
      updated[index].costPrice = qty > 0 ? updated[index].totalSum / qty : 0;
    }
    setItems(updated);
  };

  const updateItemCostPrice = (index: number, cost: number) => {
    const updated = [...items];
    updated[index].costPrice = cost;
    updated[index].totalSum = updated[index].quantity * cost;
    updated[index].lastEdited = "costPrice";
    setItems(updated);
  };

  const updateItemTotalSum = (index: number, sum: number) => {
    const updated = [...items];
    updated[index].totalSum = sum;
    updated[index].costPrice = updated[index].quantity > 0 ? sum / updated[index].quantity : 0;
    updated[index].lastEdited = "totalSum";
    setItems(updated);
  };

  const updateItemSalePrice = (index: number, value: string) => {
    const updated = [...items];
    updated[index].salePrice = value;
    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce((sum, item) => sum + item.totalSum, 0);

  const handleCreate = () => {
    if (items.length === 0) {
      toast.error("Добавьте хотя бы один товар");
      return;
    }
    createMutation.mutate({
      supplierName: supplierName || undefined,
      invoiceNumber: invoiceNumber || undefined,
      notes: notes || undefined,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        costPrice: item.costPrice,
        // Only a price the manager actually typed is sent; otherwise the
        // shelf price stays untouched.
        salePrice: item.salePrice === "" ? undefined : parseFloat(item.salePrice),
      })),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Приход товаров</h1>
          <p className="text-gray-500">Оформление поставок на склад</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />
          Новый приход
        </button>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="p-4">Дата</th>
                <th className="p-4">Поставщик</th>
                <th className="p-4">Накладная</th>
                <th className="p-4">Товаров</th>
                <th className="p-4 text-right">Сумма</th>
                <th className="p-4">Сотрудник</th>
                <th className="p-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {receipts.map((receipt) => (
                <tr key={receipt.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      {new Date(receipt.createdAt).toLocaleDateString("ru-RU")}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      {receipt.supplierName || "—"}
                    </div>
                  </td>
                  <td className="p-4 text-sm text-gray-500">{receipt.invoiceNumber || "—"}</td>
                  <td className="p-4 text-sm text-gray-500">{receipt.items.length} поз.</td>
                  <td className="p-4 whitespace-nowrap text-right font-medium text-gray-900">{money(receipt.totalAmount)}</td>
                  <td className="p-4 text-sm text-gray-500">{receipt.user?.firstName} {receipt.user?.lastName}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => setShowDetail(receipt)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {receipts.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      compact
                      icon={<Truck className="h-6 w-6" />}
                      title="Приходов пока нет"
                      description="Приход — это поступление товара от поставщика: остатки растут, себестоимость пересчитывается по цене закупки."
                      action={
                        <button onClick={() => setShowCreate(true)} className="btn-primary">
                          <Plus className="mr-2 h-4 w-4" />
                          Оформить приход
                        </button>
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Новый приход" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Поставщик</label>
              <input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="input"
                placeholder="Название поставщика"
              />
            </div>
            <div>
              <label className="label">Номер накладной</label>
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="input"
                placeholder="Номер документа"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Товары</h3>

            <div className="relative mb-3" ref={searchRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="input text-sm pl-10"
                  placeholder="Начните вводить название товара..."
                />
              </div>
              {showSuggestions && searchQuery && filteredProducts.length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-surface shadow-lg">
                  {filteredProducts.slice(0, 10).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        handleProductSelect(p);
                        setSearchQuery("");
                        setShowSuggestions(false);
                      }}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <span className="text-sm font-medium text-gray-900">{p.name}</span>
                        {p.volume && <span className="text-sm text-gray-500 ml-2">— {p.volume}</span>}
                      </div>
                      <span className="text-sm text-gray-500">{money(p.costPrice || 0)}/шт</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-2">
                  <div className="col-span-3">Товар</div>
                  <div className="col-span-1">Кол-во</div>
                  <div className="col-span-2">Себестоимость</div>
                  <div className="col-span-2">Сумма</div>
                  <div className="col-span-3">Цена продажи</div>
                  <div className="col-span-1"></div>
                </div>
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg px-2 py-2">
                    <div className="col-span-3 text-sm font-medium truncate">{item.productName}</div>
                    <div className="col-span-1">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity || ""}
                        onChange={(e) => updateItemQty(index, parseFloat(e.target.value) || 0)}
                        className="input text-sm py-1.5"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.costPrice || ""}
                        onChange={(e) => updateItemCostPrice(index, parseFloat(e.target.value) || 0)}
                        className="input text-sm py-1.5"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.totalSum || ""}
                        onChange={(e) => updateItemTotalSum(index, parseFloat(e.target.value) || 0)}
                        className="input text-sm py-1.5"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.salePrice}
                        onChange={(e) => updateItemSalePrice(index, e.target.value)}
                        placeholder={`сейчас ${money(item.currentPrice)}`}
                        className="input text-sm py-1.5"
                      />
                      {item.salePrice !== "" && item.costPrice > 0 && (
                        <p
                          className={`mt-0.5 text-[11px] ${
                            parseFloat(item.salePrice) > item.costPrice ? "text-success-600" : "text-danger-600"
                          }`}
                        >
                          маржа {money(parseFloat(item.salePrice) - item.costPrice)}
                        </p>
                      )}
                    </div>
                    <div className="col-span-1 text-right">
                      <button onClick={() => removeItem(index)} className="text-danger-500 hover:text-danger-700">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-gray-500">
                    Цена продажи меняется только там, где вы её указали
                  </span>
                  <span className="text-lg font-bold text-gray-900">Итого: {money(totalAmount)}</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="label">Примечание</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input"
              placeholder="Необязательно"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Отмена</button>
            <button
              onClick={handleCreate}
              disabled={items.length === 0 || createMutation.isPending}
              className="btn-primary"
            >
              {createMutation.isPending ? "Сохранение..." : "Оформить приход"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title="Детали прихода" size="md">
        {showDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Дата:</span> <span className="font-medium">{new Date(showDetail.createdAt).toLocaleDateString("ru-RU")}</span></div>
              <div><span className="text-gray-500">Поставщик:</span> <span className="font-medium">{showDetail.supplierName || "—"}</span></div>
              <div><span className="text-gray-500">Накладная:</span> <span className="font-medium">{showDetail.invoiceNumber || "—"}</span></div>
              <div><span className="text-gray-500">Сотрудник:</span> <span className="font-medium">{showDetail.user?.firstName} {showDetail.user?.lastName}</span></div>
            </div>
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Товары</h4>
              <div className="space-y-2">
                {showDetail.items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <div>
                      <span className="text-sm font-medium">{item.product.name}</span>
                      <span className="text-xs text-gray-500 ml-2">{item.product.sku}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-gray-500">{item.quantity} шт. × {money(item.costPrice)}</span>
                      <span className="text-sm font-medium ml-2">{money(item.totalCost)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-3 border-t mt-3">
                <span className="text-lg font-bold text-gray-900">Итого: {money(showDetail.totalAmount)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
