import { useQuery } from "@tanstack/react-query";
import { settingsService } from "../services";
import { currencySymbol, formatMoney } from "../utils/money";

/**
 * Money formatter bound to the tenant's configured currency. The settings
 * response is cached by react-query, so every screen shares one request and
 * one answer to "which currency is this shop in".
 */
export function useMoney() {
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsService.get().then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const currency: string = settings?.currency || "USD";

  return {
    currency,
    symbol: currencySymbol(currency),
    money: (amount: number | string | null | undefined) => formatMoney(amount, currency),
  };
}
