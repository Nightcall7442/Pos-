import { useQuery } from "@tanstack/react-query";
import { reportService } from "../services";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => reportService.getDashboard().then((r) => r.data.data),
    refetchInterval: 60000,
  });
}

export function useSalesReport(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ["sales-report", dateFrom, dateTo],
    queryFn: () => reportService.getSales({ dateFrom, dateTo }).then((r) => r.data.data),
    enabled: !!dateFrom && !!dateTo,
  });
}
