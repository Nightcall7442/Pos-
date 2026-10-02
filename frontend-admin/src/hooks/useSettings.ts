import { useQuery } from "@tanstack/react-query";
import { settingsService } from "../services";

/**
 * Настройки точки: тип (магазин или кафе), валюта, код для кассы. Один запрос
 * на всё приложение — react-query отдаёт его из кэша каждому экрану.
 */
export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsService.get().then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
}

/** Магазин — товары со штрихкодом, кафе — блюда без него: от этого зависят подсказки. */
export function useIsRetail(): boolean {
  return useSettings().data?.businessType === "retail";
}
