import axios from "axios";

// Текст ошибки из ответа API ({ success: false, error: "…" }) или запасной.
// Вместо `(error: any) => error.response?.data?.error` в каждом onError.
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ error?: string }>(error)) return error.response?.data?.error || fallback;
  return fallback;
}
