import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { authService, type RegisterInput } from "../services";
import { useAuthStore } from "../store/authStore";

export function useLogin() {
  const login = useAuthStore((s) => s.login);

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authService.login(email, password).then((r) => r.data.data),
    onSuccess: (data) => {
      login(data.user, data.accessToken, data.refreshToken);
      toast.success("Добро пожаловать!");
    },
    onError: (error: any) => {
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
