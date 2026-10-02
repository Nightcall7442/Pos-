import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkConnection, PING_INTERVAL_MS, reportReachable, reportUnreachable, resetConnection, useConnection } from "./connection";
import { formatElapsed } from "../components/ConnectionStatus";

describe("связь с сервером", () => {
  beforeEach(() => {
    resetConnection();
    vi.useFakeTimers();
  });
  afterEach(() => {
    resetConnection();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("запрос без ответа — нет связи, с момента первого сбоя", () => {
    vi.setSystemTime(10_000);
    reportUnreachable();
    vi.setSystemTime(15_000);
    reportUnreachable();
    expect(useConnection.getState()).toMatchObject({ problem: "server", since: 10_000 });
    reportReachable();
    expect(useConnection.getState()).toMatchObject({ problem: null, since: null });
  });

  it("пока связи нет, касса сама проверяет сервер и снимает предупреждение", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    reportUnreachable();
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledWith("/api/health", expect.objectContaining({ cache: "no-store" }));
    expect(useConnection.getState().problem).toBeNull();
    // связь вернулась — проверки прекращаются
    await vi.advanceTimersByTimeAsync(PING_INTERVAL_MS * 3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("502 от прокси при упавшем сервере — это не «связь есть»", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502 }));
    expect(await checkConnection()).toBe(false);
    expect(useConnection.getState().problem).toBe("server");
  });

  it("нет сети у планшета — отдельный текст: проблема не на сервере", () => {
    vi.stubGlobal("navigator", { onLine: false });
    reportUnreachable();
    expect(useConnection.getState().problem).toBe("device");
    // ответ на запрос, отправленный до пропажи сети, не снимает «нет сети»
    reportReachable();
    expect(useConnection.getState().problem).toBe("device");
  });

  it("сколько нет связи — минуты и секунды, после часа — с часами", () => {
    expect(formatElapsed(42_000)).toBe("0:42");
    expect(formatElapsed(12 * 60_000 + 5_000)).toBe("12:05");
    expect(formatElapsed(3600_000 + 3 * 60_000 + 20_000)).toBe("1:03:20");
  });
});
