import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { techCardService } from "../services";
import type { TechCardItem } from "../services";

interface TechCardParams {
  search?: string;
  isActive?: boolean;
  limit?: number;
}

export function useTechCards(params?: TechCardParams) {
  return useQuery({
    queryKey: ["techCards", params],
    queryFn: () => techCardService.list(params as Record<string, string | number | boolean | undefined>).then((r) => r.data.data),
  });
}

export function useTechCard(id: string) {
  return useQuery({
    queryKey: ["techCard", id],
    queryFn: () => techCardService.get(id).then((r) => r.data.data),
    enabled: !!id,
  });
}

export function useCreateTechCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; ingredients?: TechCardItem[]; output?: number; unit?: string }) =>
      techCardService.create(data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["techCards"] });
      toast.success("Техкарта создана");
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || "Не удалось создать техкарту");
    },
  });
}

export function useUpdateTechCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; ingredients: TechCardItem[]; output: number; unit: string }> }) =>
      techCardService.update(id, data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["techCards"] });
      qc.invalidateQueries({ queryKey: ["techCard"] });
      toast.success("Техкарта обновлена");
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || "Не удалось обновить техкарту");
    },
  });
}

export function useDeleteTechCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => techCardService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["techCards"] });
      toast.success("Техкарта удалена");
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || "Не удалось удалить техкарту");
    },
  });
}

export function useCopyTechCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => techCardService.copy(id).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["techCards"] });
      toast.success("Техкарта скопирована");
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || "Не удалось скопировать техкарту");
    },
  });
}
