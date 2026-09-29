import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { authService, type RegisterInput } from "../services";
import { useAuthStore } from "../store/authStore";
import { canOpenPanel, PanelAccessError } from "../utils/access";

export function useLogin() {
  const login = useAuthStore((s) => s.login);

  return useMutation({
    // Роль проверяем здесь, а не в onSuccess: так вход кассира честно
    // считается неудачным — сессия не сохраняется и экран не переключается.
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const data = await authService.login(email, password).then((r) => r.data.data);
      if (!canOpenPanel(data.user.role)) throw new PanelAccessError();
      return data;
    },
    onSuccess: (data) => {
      login(data.user, data.accessToken, data.refreshToken);
      toast.success("Добро пожаловать!");
    },
    onError: (error: any) => {
      if (error instanceof PanelAccessError) {
        toast.error(error.message);
        return;
      }
      toast.error(error.response?.data?.error || "Ошибка входа");
    },
  });
}

export function useRegister() {
  const login = useAuthStore((s) => s.login);

  return useMutation({
    mutationFn: (data: RegisterInput) => authService.register(data).then((r) => r.data.data),
    onSuccess: (data) => {
      login(data.user, data.accessToken, data.refreshToken);
      toast.success("Заведение создано");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Не удалось зарегистрироваться");
    },
  });
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);

  return () => {
    logout();
    window.location.href = "/login";
  };
}
