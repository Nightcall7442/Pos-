import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  LogOut,
  User,
  UtensilsCrossed,
  Package,
  X,
  ChevronRight,
  Receipt,
  Clock,
  Hash,
  Phone,
  AlertCircle,
  Lock,
  PackagePlus,
  Sun,
  Moon,
} from "lucide-react";
import api from "../services/api";
import { useCartStore } from "../store/cartStore";
import { useThemeStore } from "../store/themeStore";
import toast from "react-hot-toast";
import { useMoney } from "../hooks/useMoney";
import type { Category, Product, CashShift, Table } from "../types";
import StockReceiptScreen from "./StockReceiptScreen";

interface MenuScreenProps {
  user: { firstName: string; lastName: string; email: string; role: string };
  shift: CashShift;
  onLogout: () => void;
  onCheckout: () => void;
  onCloseShift: () => void;
}


// Keyword → emoji, matched case-insensitively against the category name, so a
// shop naming its categories in Russian gets real icons instead of the generic
// box every time.
const CATEGORY_ICONS: [RegExp, string][] = [
  [/burger|бургер/i, "🍔"],
  [/pizza|пицц/i, "🍕"],
  [/salad|салат/i, "🥗"],
  [/drink|напит|вода|сок/i, "🥤"],
  [/coffee|кофе|чай|tea/i, "☕"],
  [/dessert|десерт|торт|выпеч/i, "🍰"],
  [/soup|суп/i, "🍲"],
  [/breakfast|завтрак/i, "🍳"],
  [/meat|мяс|гриль|grill|шашлык|кебаб/i, "🍖"],
  [/fish|рыб|суши|sushi/i, "🍣"],
  [/snack|закус|фри|fries/i, "🍟"],
  [/alcohol|алкогол|пиво|beer|вино|wine/i, "🍺"],
  [/ice|морожен/i, "🍨"],
];

function categoryEmoji(name: string): string {
  for (const [pattern, emoji] of CATEGORY_ICONS) {
    if (pattern.test(name)) return emoji;
  }
  return "🍽";
}


function useCurrentTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);
  return time;
}

function groupProductsByName(products: Product[]): Product[][] {
  const groups = new Map<string, Product[]>();
  for (const p of products) {
    const key = p.name.toLowerCase().trim();
    const existing = groups.get(key) || [];
    existing.push(p);
    groups.set(key, existing);
  }
  return Array.from(groups.values());
}

// Синтетическая плитка «Без категории».
const UNCATEGORIZED = "__none__";

export default function MenuScreen({ user, onLogout, onCheckout, onCloseShift }: MenuScreenProps) {
  const { money } = useMoney();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [showCustomerInput, setShowCustomerInput] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [volumePickerProduct, setVolumePickerProduct] = useState<Product[] | null>(null);
  const [portionPickerProduct, setPortionPickerProduct] = useState<Product | null>(null);
  const [showStockReceipt, setShowStockReceipt] = useState(false);
  const { theme, toggleTheme } = useThemeStore();
  const time = useCurrentTime();

  const portionOptions = [5, 10, 50, 100];

  const {
    items,
    tableId,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getTotal,
    getItemCount,
    orderType,
    setOrderType,
    setTable,
    setCustomer,
  } = useCartStore();

  const { data: categoriesAll, isLoading: isLoadingCat, error: catError } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get("/categories").then((r) => r.data.data),
  });
  const categories = categoriesAll?.filter((c) => !c.isIngredient) || [];

  // Real tables from the backend — the order needs the table's id, not a
  // number typed by hand.
  const { data: tables = [] } = useQuery<Table[]>({
    queryKey: ["tables"],
    queryFn: () =>
      api.get("/tables").then((r) =>
        // Numeric table numbers in natural order (1, 2, …, 10), others alphabetically.
        (r.data.data as Table[]).slice().sort((a, b) =>
          a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" })
        )
      ),
    enabled: orderType === "dine_in" || !!tableId,
  });
  const selectedTable = tables.find((t) => t.id === tableId);
  const tableNumber = selectedTable?.number ?? "";

  const { data: allProductsData, isLoading: isLoadingProd, error: prodError } = useQuery<{ data: Product[] }>({
    queryKey: ["products-all", search],
    queryFn: () =>
      api.get("/products", {
        params: { search: search || undefined, limit: 200, isActive: true, isIngredient: false },
      }).then((r) => r.data),
  });

  const allProducts: Product[] = useMemo(() => allProductsData?.data || [], [allProductsData]);

  // Отбор — в useMemo: раньше массив собирался заново на каждой перерисовке, и
  // useMemo группировки ниже, зависящий от него, пересчитывался каждый раз.
  const filteredProducts: Product[] = useMemo(() => {
    const matchesCategory = (p: Product): boolean =>
      selectedCategory === UNCATEGORIZED ? !p.categoryId : p.categoryId === selectedCategory;
    if (search) return allProducts.filter((p) => !selectedCategory || matchesCategory(p));
    if (selectedCategory) return allProducts.filter(matchesCategory);
    return [];
  }, [allProducts, search, selectedCategory]);

  // Products that belong to no category are reachable through a synthetic
  // tile; without it they could only be found by typing their name.
  const uncategorizedCount = allProducts.filter((p) => !p.categoryId).length;

  const groupedProducts = useMemo(() => groupProductsByName(filteredProducts), [filteredProducts]);

  // Stock already committed to the cart counts as taken: the backend will
  // refuse the sale anyway, so the terminal refuses it up front instead of
  // letting the cashier ring up an item that cannot be paid for.
  const availableStock = (product: Product): number => {
    if (!product.trackInventory) return Number.POSITIVE_INFINITY;
    const inCart = items
      .filter((i) => i.productId === product.id)
      .reduce((sum, i) => sum + (i.grams ? i.grams : i.quantity), 0);
    return Number(product.currentStock) - inCart;
  };

  const handleProductClick = (variants: Product[], _event: React.MouseEvent): void => {
    if (variants.length === 1) {
      const product = variants[0];
      const saleUnit = product.saleUnit;
      if (saleUnit === "г") {
        if (availableStock(product) <= 0) {
          toast.error(`«${product.name}» нет в наличии`, { duration: 1500 });
          return;
        }
        setPortionPickerProduct(product);
        return;
      }
      handleAddProduct(product);
    } else {
      setVolumePickerProduct(variants);
    }
  };

  const handlePortionSelect = (product: Product, grams: number): void => {
    if (grams > availableStock(product)) {
      toast.error(`«${product.name}»: осталось ${Number(product.currentStock)} г`, { duration: 2000 });
      return;
    }
    const pricePerGram = Number(product.price);
    const portionPrice = pricePerGram * grams;
    const volumeLabel = product.volume ? ` (${product.volume})` : "";

    addItem({
      productId: product.id,
      name: product.name + volumeLabel + ` (${grams} г)`,
      price: portionPrice,
      quantity: 1,
      grams,
    });
    toast.success(`${product.name} (${grams} г) добавлен`, { duration: 1000 });
    setPortionPickerProduct(null);
  };

  const handleAddProduct = (product: Product): void => {
    if (availableStock(product) <= 0) {
      toast.error(`«${product.name}» нет в наличии`, { duration: 1500 });
      return;
    }
    const volumeLabel = product.volume ? ` (${product.volume})` : "";
    const pricePerUnit = Number(product.price);

    addItem({
      productId: product.id,
      name: product.name + volumeLabel,
      price: pricePerUnit,
      quantity: 1,
    });
    toast.success(`${product.name}${volumeLabel} добавлен`, { duration: 1000 });
  };

  const handleSelectVolume = (product: Product): void => {
    handleAddProduct(product);
    setVolumePickerProduct(null);
  };

  const getQtyInCart = (productId: string): number => {
    const item = items.find((i) => i.productId === productId || i.productId.startsWith(productId));
    return item?.quantity || 0;
  };

  const getTotalQtyForGroup = (variants: Product[]): number => {
    return variants.reduce((sum, v) => sum + getQtyInCart(v.id), 0);
  };

  const handleTableSelect = (table: Table | null) => {
    setTable(table?.id);
    setShowTablePicker(false);
    toast.success(table ? `Стол №${table.number} выбран` : "Заказ без стола");
  };

  const handleSaveCustomer = () => {
    setCustomer(customerName || undefined, customerPhone || undefined);
    setShowCustomerInput(false);
    if (customerName) toast.success(`Клиент: ${customerName}`);
  };

  const isLoading = isLoadingCat || isLoadingProd;
  const hasError = catError || prodError;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-dark-950">
      {/* ═══ Top Bar ═══ */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-dark-700 bg-dark-800 px-4 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary-500" />
          <span className="text-sm font-bold text-dark-50">Qwik</span>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-dark-700 p-0.5">
          {([
            { key: "dine_in" as const, label: "В зале", icon: UtensilsCrossed },
            { key: "takeaway" as const, label: "Навынос", icon: Package },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setOrderType(key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                orderType === key
                  ? "bg-primary-600 text-white shadow-md shadow-primary-600/20"
                  : "text-dark-400 hover:text-dark-50 hover:bg-dark-600"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="whitespace-nowrap">{label}</span>
            </button>
          ))}
        </div>

        {orderType === "dine_in" && (
          <button
            onClick={() => setShowTablePicker(true)}
            className="flex items-center gap-1.5 rounded-lg bg-dark-700 px-3 py-1.5 text-xs font-medium text-dark-300 hover:bg-dark-600 hover:text-dark-50 transition-colors"
          >
            <Hash className="h-3.5 w-3.5" />
            {tableNumber ? `Стол ${tableNumber}` : "Выбрать стол"}
          </button>
        )}

        <button
          onClick={() => setShowCustomerInput(true)}
          className="flex items-center gap-1.5 rounded-lg bg-dark-700 px-3 py-1.5 text-xs font-medium text-dark-300 hover:bg-dark-600 hover:text-dark-50 transition-colors"
        >
          <User className="h-3.5 w-3.5" />
          {customerName || "Клиент"}
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 text-xs text-dark-400">
          <Clock className="h-3.5 w-3.5" />
          <span>{time.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>

        <div className="w-px h-5 bg-dark-600" />

        <button
          onClick={() => setShowStockReceipt(true)}
          className="flex items-center gap-1.5 rounded-lg bg-dark-700 px-2.5 py-1.5 text-xs font-medium text-dark-300 hover:bg-primary-600/20 hover:text-primary-400 transition-colors"
          title="Оформить приход товара"
        >
          <PackagePlus className="h-3.5 w-3.5" />
          <span>Приход</span>
        </button>

        <div className="w-px h-5 bg-dark-600" />

        <button
          onClick={toggleTheme}
          className="flex items-center gap-1.5 rounded-lg bg-dark-700 px-2.5 py-1.5 text-xs font-medium text-dark-300 hover:bg-primary-600/20 hover:text-primary-400 transition-colors"
          title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
        >
          {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>

        <div className="w-px h-5 bg-dark-600" />

        <button
          onClick={onCloseShift}
          className="flex items-center gap-1.5 rounded-lg bg-dark-700 px-2.5 py-1.5 text-xs font-medium text-dark-300 hover:bg-danger-600/20 hover:text-danger-400 transition-colors"
          title="Закрыть смену"
        >
          <Lock className="h-3.5 w-3.5" />
          <span>Смена</span>
          <span className="flex h-2 w-2 rounded-full bg-success-500" />
        </button>

        <div className="w-px h-5 bg-dark-600" />

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg bg-dark-700 px-2.5 py-1">
            <User className="h-3.5 w-3.5 text-dark-400" />
            <span className="text-xs font-medium text-dark-300">{user.firstName}</span>
          </div>
          <button
            onClick={onLogout}
            className="rounded-lg p-1.5 text-dark-400 hover:bg-dark-700 hover:text-danger-500 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* ═══ Table Picker Modal ═══ */}
      {showTablePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-3xl border border-dark-600 bg-dark-800 p-6 w-96 shadow-2xl" style={{ animation: "scale-in 0.2s ease" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-dark-50">Выберите стол</h3>
              <button onClick={() => setShowTablePicker(false)} className="rounded-lg p-1 text-dark-400 hover:text-dark-50">
                <X className="h-5 w-5" />
              </button>
            </div>
            {tables.length === 0 ? (
              <p className="py-6 text-center text-sm text-dark-400">Столы не заведены — добавьте их в панели управления</p>
            ) : (
              <div className="grid grid-cols-4 gap-2 max-h-80 overflow-y-auto">
                {tables.map((table) => {
                  const busy = table.status === "occupied" || (table.orders?.length ?? 0) > 0;
                  return (
                    <button
                      key={table.id}
                      onClick={() => handleTableSelect(table)}
                      title={table.zone || undefined}
                      className={`relative flex h-14 flex-col items-center justify-center rounded-xl border-2 text-sm font-bold transition-all active:scale-95 ${
                        tableId === table.id
                          ? "border-primary-500 bg-primary-600/20 text-primary-400"
                          : busy
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
                          : "border-dark-600 bg-dark-700 text-dark-300 hover:border-dark-400 hover:text-dark-50"
                      }`}
                    >
                      {table.number}
                      {busy && <span className="text-[9px] font-medium">занят</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {tableId && (
              <button
                onClick={() => handleTableSelect(null)}
                className="mt-3 w-full rounded-xl border border-dark-600 bg-dark-700 py-2 text-xs font-medium text-dark-300 hover:text-dark-50"
              >
                Убрать стол
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══ Customer Input Modal ═══ */}
      {showCustomerInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-3xl border border-dark-600 bg-dark-800 p-6 w-96 shadow-2xl" style={{ animation: "scale-in 0.2s ease" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-dark-50">Информация о клиенте</h3>
              <button onClick={() => setShowCustomerInput(false)} className="rounded-lg p-1 text-dark-400 hover:text-dark-50">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-400" />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Имя клиента"
                  className="w-full rounded-xl border-2 border-dark-600 bg-dark-700 py-3 pl-10 pr-4 text-sm text-dark-50 placeholder:text-dark-500 focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-400" />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Телефон"
                  className="w-full rounded-xl border-2 border-dark-600 bg-dark-700 py-3 pl-10 pr-4 text-sm text-dark-50 placeholder:text-dark-500 focus:border-primary-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowCustomerInput(false)} className="flex-1 rounded-xl border border-dark-600 bg-dark-700 py-2.5 text-sm font-medium text-dark-300 hover:text-dark-50">Отмена</button>
              <button onClick={handleSaveCustomer} className="flex-1 rounded-xl bg-primary-600 py-2.5 text-sm font-bold text-white hover:bg-primary-500">Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Main ═══ */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* ─── Left: Cart ─── */}
        <aside className="flex w-[380px] flex-col border-r border-dark-700 bg-dark-900 shrink-0">
          <div className="flex items-center justify-between border-b border-dark-700 px-4 py-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary-400" />
              <span className="text-sm font-semibold text-dark-50">Заказ</span>
              {getItemCount() > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[10px] font-bold text-white">
                  {getItemCount()}
                </span>
              )}
            </div>
            {items.length > 0 && (
              <button onClick={clearCart} className="rounded-lg p-1.5 text-dark-400 hover:bg-dark-700 hover:text-danger-500 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {items.length > 0 && (
            <div className="flex items-center px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-dark-500 border-b border-dark-700/50">
              <span className="flex-1">Наименование</span>
              <span className="w-14 text-center">Кол-во</span>
              <span className="w-16 text-center">Цена</span>
              <span className="w-20 text-right">Итого</span>
              <span className="w-8" />
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-dark-500">
                <ShoppingCart className="h-14 w-14 mb-3 opacity-20" />
                <p className="text-sm">Корзина пуста</p>
                <p className="text-[11px] text-dark-600 mt-1">Выберите товары из меню</p>
              </div>
            ) : (
              <div>
                {items.map((item) => (
                  <div key={item.id} className="flex items-center border-b border-dark-700/50 px-4 py-3 hover:bg-dark-800/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-dark-50">{item.name}</p>
                    </div>
                    <div className="flex items-center gap-1 w-14 justify-center">
                      <button
                        onClick={() => item.quantity <= 1 ? removeItem(item.id) : updateQuantity(item.id, item.quantity - 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-dark-700 text-dark-300 hover:bg-dark-600 hover:text-dark-50 transition-colors active:scale-90"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-5 text-center text-xs font-bold text-dark-50">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white hover:bg-primary-500 transition-colors active:scale-90"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="w-16 text-center text-[11px] text-dark-400">{Math.round(item.price)}</span>
                    <span className="w-20 text-right text-xs font-bold text-dark-50">{money(item.price * item.quantity)}</span>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="w-8 h-8 flex items-center justify-center text-dark-500 hover:text-danger-500 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-dark-700 px-4 py-4 space-y-3 bg-dark-800/50">
            {tableNumber && orderType === "dine_in" && (
              <div className="flex items-center justify-between text-xs text-dark-400">
                <span>Стол</span>
                <span className="text-dark-50 font-medium">№{tableNumber}</span>
              </div>
            )}
            {customerName && (
              <div className="flex items-center justify-between text-xs text-dark-400">
                <span>Клиент</span>
                <span className="text-dark-50 font-medium">{customerName}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-dark-400">
              <span>Позиций</span>
              <span>{getItemCount()} шт.</span>
            </div>
            <div className="flex items-center justify-between border-t border-dark-600 pt-3">
              <span className="text-sm font-semibold text-dark-50">К оплате</span>
              <span className="text-2xl font-bold text-primary-400">{money(getTotal())}</span>
            </div>
            <button
              onClick={onCheckout}
              disabled={items.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-4 text-sm font-bold text-white shadow-lg shadow-primary-600/25 transition-all hover:bg-primary-500 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Оплатить
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </aside>

        {/* ─── Right: Menu ─── */}
        <main className="flex flex-1 flex-col overflow-hidden bg-dark-950">
          <div className="flex items-center gap-3 border-b border-dark-700 bg-dark-800 px-5 py-3 shrink-0">
            <h2 className="text-sm font-semibold text-dark-50 whitespace-nowrap">Все товары</h2>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск..."
                className="w-full rounded-lg border border-dark-600 bg-dark-700 py-2 pl-9 pr-8 text-sm text-dark-50 placeholder:text-dark-500 focus:border-primary-500 focus:outline-none transition-colors"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-50">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-dark-500 border-t-primary-500" />
              </div>
            ) : hasError ? (
              <div className="flex h-full flex-col items-center justify-center text-dark-500">
                <AlertCircle className="h-14 w-14 mb-3 text-danger-500 opacity-50" />
                <p className="text-sm text-danger-400">Ошибка загрузки данных</p>
                <p className="text-[11px] text-dark-600 mt-1">Проверьте подключение к серверу</p>
              </div>
            ) : search || selectedCategory ? (
              <>
                {(search || selectedCategory) && (
                  <button
                    onClick={() => { setSearch(""); setSelectedCategory(""); }}
                    className="mb-4 flex items-center gap-1.5 text-sm text-dark-400 hover:text-dark-50 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4 rotate-180" />
                    Назад к категориям
                  </button>
                )}

                {groupedProducts.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-dark-500">
                    <Package className="h-14 w-14 mb-3 opacity-20" />
                    <p className="text-sm">Нет товаров</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                    {groupedProducts.map((variants) => {
                      const product = variants[0];
                      const totalQty = getTotalQtyForGroup(variants);
                      const hasVariants = variants.length > 1;
                      return (
                        <button
                          key={product.id}
                          onClick={(e) => handleProductClick(variants, e)}
                          className={`group relative flex flex-col items-center rounded-2xl border p-4 transition-all active:scale-[0.96] ${
                            totalQty > 0
                              ? "border-primary-500/50 bg-primary-600/10 shadow-md shadow-primary-500/10"
                              : "border-dark-700 bg-dark-800 hover:border-dark-500 hover:bg-dark-750 hover:shadow-lg"
                          }`}
                        >
                          {totalQty > 0 && (
                            <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary-500 px-1.5 text-[11px] font-bold text-white shadow-md">
                              {totalQty}
                            </span>
                          )}
                          {!hasVariants && product.trackInventory && (
                            <span
                              className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm ${
                                product.currentStock <= 0
                                  ? "bg-danger-500/90 text-white"
                                  : product.currentStock <= product.minStock
                                  ? "bg-amber-500/90 text-white"
                                  : "bg-dark-950/70 text-dark-300"
                              }`}
                            >
                              {product.currentStock <= 0 ? "нет в наличии" : `ост. ${product.currentStock}`}
                            </span>
                          )}
                          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-dark-700 text-3xl group-hover:bg-dark-600 transition-colors overflow-hidden">
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                            ) : (
                              categoryEmoji(product.category?.name || "")
                            )}
                          </div>
                          <span className="w-full text-center text-sm font-medium text-dark-300 line-clamp-1 group-hover:text-dark-50 transition-colors">
                            {product.name}
                          </span>
                          {hasVariants ? (
                            <span className="text-xs text-primary-400 mt-1">
                              от {money(Math.min(...variants.map((v) => Number(v.price))))}
                            </span>
                          ) : (
                            <span className="text-base font-bold text-primary-400 mt-1">
                              {money(Number(product.price))}
                            </span>
                          )}
                          {hasVariants && (
                            <span className="mt-1 text-[10px] text-dark-500">
                              {variants.length} вариантов
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4">
                {uncategorizedCount > 0 && (
                  <button
                    onClick={() => setSelectedCategory(UNCATEGORIZED)}
                    className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-dark-700 bg-dark-800 p-6 transition-all hover:border-primary-500/50 hover:bg-dark-750 active:scale-[0.97]"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-dark-700 text-3xl transition-transform group-hover:scale-110">
                      📦
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-dark-50 group-hover:text-primary-400 transition-colors">Без категории</p>
                      <p className="text-[11px] text-dark-500 mt-0.5">{uncategorizedCount} товаров</p>
                    </div>
                  </button>
                )}
                {categories?.map((cat, idx) => {
                  const count = allProducts.filter((p) => p.categoryId === cat.id).length;
                  const emoji = categoryEmoji(cat.name);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-dark-700 bg-dark-800 p-6 transition-all hover:border-primary-500/50 hover:bg-dark-750 hover:shadow-xl hover:shadow-primary-500/5 active:scale-[0.97]"
                      style={{ animation: `fade-in 0.25s ease ${idx * 0.05}s both` }}
                    >
                      {cat.imageUrl ? (
                        <img
                          src={cat.imageUrl}
                          alt={cat.name}
                          className="h-16 w-16 rounded-2xl object-cover transition-transform group-hover:scale-110"
                        />
                      ) : (
                        <div
                          className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl font-bold transition-transform group-hover:scale-110"
                          style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                        >
                          {emoji}
                        </div>
                      )}
                      <div className="text-center">
                        <p className="text-sm font-semibold text-dark-50 group-hover:text-primary-400 transition-colors">{cat.name}</p>
                        <p className="text-[11px] text-dark-500 mt-0.5">{count} товаров</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ═══ Volume Picker — Modal (center screen) ═══ */}
      {volumePickerProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" style={{ animation: "fade-in 0.2s ease" }}>
          <div className="rounded-3xl border border-dark-600 bg-dark-800 shadow-2xl w-full max-w-lg" style={{ animation: "scale-in 0.2s ease" }}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-dark-700">
              <div>
                <h3 className="text-xl font-bold text-dark-50">{volumePickerProduct[0].name}</h3>
                <p className="text-sm text-dark-400">Выберите объём</p>
              </div>
              <button
                onClick={() => setVolumePickerProduct(null)}
                className="rounded-xl p-2 text-dark-400 hover:bg-dark-700 hover:text-dark-50 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 p-6">
              {volumePickerProduct.map((variant) => {
                const qty = getQtyInCart(variant.id);
                return (
                  <button
                    key={variant.id}
                    onClick={() => handleSelectVolume(variant)}
                    className={`relative flex flex-col items-center gap-3 rounded-2xl border-2 px-6 py-8 transition-all active:scale-95 ${
                      qty > 0
                        ? "border-primary-500 bg-primary-600/10"
                        : "border-dark-600 bg-dark-700 hover:border-primary-500/50 hover:bg-dark-600"
                    }`}
                  >
                    {qty > 0 && (
                      <span className="absolute -right-2 -top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-primary-500 px-2 text-xs font-bold text-white shadow-md">
                        {qty}
                      </span>
                    )}
                    <span className="text-3xl font-bold text-dark-50">{variant.volume || "—"}</span>
                    <span className="text-xl font-bold text-primary-400">{money(Number(variant.price))}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Portion Picker (for gram products) ═══ */}
      {portionPickerProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" style={{ animation: "fade-in 0.2s ease" }}>
          <div className="rounded-3xl border border-dark-600 bg-dark-800 shadow-2xl w-full max-w-md" style={{ animation: "scale-in 0.2s ease" }}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-dark-700">
              <div>
                <h3 className="text-xl font-bold text-dark-50">{portionPickerProduct.name}</h3>
                <p className="text-sm text-dark-400">Выберите порцию</p>
              </div>
              <button
                onClick={() => setPortionPickerProduct(null)}
                className="rounded-xl p-2 text-dark-400 hover:bg-dark-700 hover:text-dark-50 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 p-6">
              {portionOptions.map((grams) => {
                const pricePerGram = Number(portionPickerProduct.price);
                const portionPrice = pricePerGram * grams;
                return (
                  <button
                    key={grams}
                    onClick={() => handlePortionSelect(portionPickerProduct, grams)}
                    className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dark-600 bg-dark-700 px-6 py-6 transition-all hover:border-primary-500/50 hover:bg-dark-600 active:scale-95"
                  >
                    <span className="text-3xl font-bold text-dark-50">{grams} г</span>
                    <span className="text-lg font-bold text-primary-400">{money(portionPrice)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Stock Receipt (Приход) ═══ */}
      {showStockReceipt && <StockReceiptScreen onClose={() => setShowStockReceipt(false)} />}
    </div>
  );
}
