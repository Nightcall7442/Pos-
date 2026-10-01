import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { orderService } from "../services";
import { apiErrorMessage } from "../utils/apiError";

export function useOrders(params?: Record<string, string | number | boolean | undefined>) {
  return useQuery({
    queryKey: ["orders", params],
    queryFn: () => orderService.list(params).then((r) => r.data),
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ["order", id],
    queryFn: () => orderService.get(id).then((r) => r.data.data),
    enabled: !!id,
  });
}

export function useActiveOrders(branchId?: string) {
  return useQuery({
    queryKey: ["orders", "active", branchId],
    queryFn: () => orderService.getActive().then((r) => r.data.data),
    refetchInterval: 10000,
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      orderService.updateStatus(id, status).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Статус заказа обновлён");
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error, "Не удалось обновить статус"));
    },
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => orderService.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Заказ отменён");
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error, "Не удалось отменить заказ"));
    },
  });
}
