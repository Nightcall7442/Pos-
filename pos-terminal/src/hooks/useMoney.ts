import { useQuery } from "@tanstack/react-query";
import api from "../services/api";
import { compactAmount, currencySymbol, formatMoney, quickCashAmounts } from "../utils/money";

/**
 * Money formatter bound to the tenant's configured currency. Cached by
 * react-query, so all screens share one settings request — and one answer to
 * "which currency is this shop in" instead of the hardcoded сўм/₽/$ mix.
 */
export function useMoney() {
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get("/settings").then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const currency: string = settings?.currency || "USD";

  return {
    currency,
    shopName: (settings?.name as string | undefined) || "Qwik",
    symbol: currencySymbol(currency),
    money: (amount: number | string | null | undefined) => formatMoney(amount, currency),
    quickAmounts: quickCashAmounts(currency),
    compact: (amount: number) => compactAmount(amount, currency),
  };
}
