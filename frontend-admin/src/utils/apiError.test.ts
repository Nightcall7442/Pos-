import { describe, it, expect } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { apiErrorMessage } from "./apiError";

// Сообщение об ошибке, которое увидит пользователь: текст сервера, если он
// есть, иначе — запасной, а не «undefined» и не стек.

const axiosError = (status: number, data: unknown) =>
  new AxiosError("Request failed", "ERR_BAD_RESPONSE", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data,
  });

describe("apiErrorMessage", () => {
  it("shows the server's own message", () => {
    expect(apiErrorMessage(axiosError(409, { success: false, error: "Email уже используется" }), "Ошибка")).toBe("Email уже используется");
  });

  it("falls back when the server said nothing useful", () => {
    expect(apiErrorMessage(axiosError(500, "<html>"), "Не удалось сохранить")).toBe("Не удалось сохранить");
    expect(apiErrorMessage(axiosError(400, { success: false }), "Не удалось сохранить")).toBe("Не удалось сохранить");
  });

  it("falls back for anything that is not an HTTP error", () => {
    expect(apiErrorMessage(new Error("network down"), "Нет связи")).toBe("Нет связи");
    expect(apiErrorMessage(undefined, "Нет связи")).toBe("Нет связи");
  });
});
