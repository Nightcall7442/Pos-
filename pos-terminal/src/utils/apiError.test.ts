import { afterEach, describe, expect, it, vi } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { apiErrorMessage, isNoConnection, paymentErrorMessage } from "./apiError";

function httpError(status: number, error?: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("Request failed", "ERR_BAD_RESPONSE", config, {}, {
    status,
    statusText: "",
    headers: {},
    config,
    data: error === undefined ? {} : { success: false, error },
  });
}

const network = () => new AxiosError("Network Error", "ERR_NETWORK", { headers: new AxiosHeaders() });

describe("ошибки на языке кассира", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("русское сообщение сервера показывается как есть", () => {
    expect(apiErrorMessage(httpError(404, "Товар не найден"), "запасной")).toBe("Товар не найден");
  });

  it("внутренние английские тексты кассиру не показываются", () => {
    expect(apiErrorMessage(httpError(400, "items.0.quantity: Expected number"), "Проверьте чек")).toBe("Проверьте чек");
    expect(apiErrorMessage(httpError(500, "Internal server error"), "x")).toMatch(/^Сбой на сервере/);
    expect(apiErrorMessage(httpError(403), "x")).toMatch(/позовите администратора/);
  });

  it("нет ответа — «нет связи», а без сети на планшете — «проверьте Wi-Fi»", () => {
    expect(apiErrorMessage(network(), "x")).toMatch(/^Нет связи с сервером/);
    vi.stubGlobal("navigator", { onLine: false });
    expect(apiErrorMessage(network(), "x")).toMatch(/Wi-Fi/);
  });

  it("ответ прокси 502–504 — тоже нет связи с сервером", () => {
    expect(isNoConnection(httpError(502))).toBe(true);
    // 500 без JSON-ответа API — это прокси (vite), сервер недоступен
    expect(isNoConnection(httpError(500))).toBe(true);
    expect(isNoConnection(httpError(500, "Internal server error"))).toBe(false);
    expect(isNoConnection(httpError(409, "Цены изменились"))).toBe(false);
    expect(isNoConnection(new Error("boom"))).toBe(false);
  });

  it("оплата без ответа: повтор безопасен, второй чек не создастся", () => {
    expect(paymentErrorMessage(network())).toMatch(/Повторите оплату: если чек уже пробит, второй не создастся/);
  });

  it("422 по ключу — первая попытка уже прошла", () => {
    const replay = httpError(422, "Этот Idempotency-Key уже использован для другого запроса");
    expect(paymentErrorMessage(replay)).toMatch(/уже пробита/);
    // слово Idempotency-Key кассиру не показываем нигде
    expect(apiErrorMessage(replay, "запасной")).toBe("запасной");
  });
});
