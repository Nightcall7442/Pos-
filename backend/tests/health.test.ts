import { describe, it, expect } from "vitest";
import { BASE_URL } from "./helpers.js";

// Касса проверяет связь по /api/health — через тот же прокси, что и остальные
// запросы. Старый /health нужен оркестратору и globalSetup.
describe("health", () => {
  it("отвечает и на /health, и на /api/health", async () => {
    for (const path of ["/health", "/api/health"]) {
      const res = await fetch(`${BASE_URL}${path}`);
      expect(res.status).toBe(200);
      expect((await res.json()).status).toBe("ok");
    }
  });
});
