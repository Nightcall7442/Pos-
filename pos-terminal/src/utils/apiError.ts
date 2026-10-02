import axios from "axios";

// Ошибки запросов — на языке кассира: что случилось и что нажать дальше.
// Вместо `(error: any) => error.response?.data?.error` в каждом onError.

const CYRILLIC = /[а-яё]/i;
// Ответ прокси (nginx, vite), когда сам сервер недоступен.
const GATEWAY = new Set([502, 503, 504]);

/** Запрос не дошёл до сервера или ответ потерялся по дороге. */
export function isNoConnection(error: unknown): boolean {
  if (!axios.isAxiosError(error) || axios.isCancel(error)) return false;
  if (!error.response) return true;
  const { status, data } = error.response;
  if (GATEWAY.has(status)) return true;
  // Наш API отвечает на сбой JSON-ом { success: false, error }. 5xx без него —
  // ответ прокси, а не сервера (vite в разработке при упавшем бэкенде даёт 500).
  return status >= 500 && !(data && typeof data === "object" && "error" in data);
}

function noConnectionText(error: unknown): string {
  if (axios.isAxiosError(error) && (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT")) {
    return "Сервер не ответил вовремя — проверьте связь и повторите";
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "Нет интернета на планшете — проверьте Wi-Fi и повторите";
  }
  return "Нет связи с сервером — повторите, когда связь вернётся";
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError<{ error?: string }>(error)) return fallback;
  if (isNoConnection(error)) return noConnectionText(error);
  const status = error.response!.status;
  if (status >= 500) return "Сбой на сервере — повторите через минуту. Не проходит — позовите администратора";
  // Сообщения сервера по-русски и уже говорят, что не так («Товар не найден»).
  // Английские — внутренние («Internal server error», ошибки валидации) — кассиру не показываем.
  const message = error.response!.data?.error;
  if (message && CYRILLIC.test(message) && !message.includes("Idempotency")) return message;
  if (status === 401) return "Сессия закончилась — войдите снова";
  if (status === 403) return "Нет прав на это действие — позовите администратора";
  return fallback;
}

/**
 * Ошибка оплаты. Без ответа сервера неизвестно, прошла ли продажа, — но повтор
 * безопасен: он уходит с тем же ключом (utils/checkoutKey.ts).
 */
export function paymentErrorMessage(error: unknown): string {
  if (isNoConnection(error)) {
    return "Связь прервалась — не видно, прошла ли оплата. Повторите оплату: если чек уже пробит, второй не создастся";
  }
  if (axios.isAxiosError(error) && error.response?.status === 422 && String(error.response.data?.error ?? "").includes("Idempotency")) {
    // Ключ уже использован другим способом оплаты — значит, первая попытка прошла.
    return "Эта продажа уже пробита — проверьте последний чек, прежде чем брать деньги ещё раз";
  }
  return apiErrorMessage(error, "Не удалось провести оплату — повторите");
}
