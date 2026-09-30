import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

export const TOKEN_KEY = "pos-token";
export const REFRESH_KEY = "pos-refresh";
export const USER_KEY = "pos-user";

export function storeTokens(accessToken: string, refreshToken?: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Access tokens live 15 minutes. When one expires, exchange the refresh token
// once (shared between concurrent 401s) and replay the failed request; only a
// failed refresh logs the cashier out.
let refreshing: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (!refreshing) {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    refreshing = (refreshToken
      ? axios.post("/api/auth/refresh", { refreshToken }).then((res) => {
          const { accessToken, refreshToken: next } = res.data.data;
          storeTokens(accessToken, next);
          return accessToken as string;
        })
      : Promise.reject(new Error("no refresh token"))
    ).finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    // 401 от самого входа — это «неверный PIN/пароль», а не протухшая сессия:
    // обновлять нечего, а reload() стёр бы сообщение об ошибке с экрана.
    const isAuthAttempt = /\/auth\/(login|login-pin|refresh)$/.test(original?.url ?? "");
    if (error.response?.status === 401 && original && !original._retry && !isAuthAttempt) {
      original._retry = true;
      try {
        const token = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        clearSession();
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
