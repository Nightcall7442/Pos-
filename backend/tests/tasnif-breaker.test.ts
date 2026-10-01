import { describe, it, expect } from "vitest";

// A server that cannot get through to the national catalogue must not make every scan wait for it:
// after two failures it stops asking, and the shop's browser (which can reach it) carries on.
describe("national catalogue, from a server that is turned away", () => {
  it("stops asking after it cannot get through, and then costs a scan nothing", async () => {
    // the settings the module reads on load (this file starts no server and builds no database client)
    process.env.DATABASE_URL ??= "postgresql://qwik:qwik@127.0.0.1:5432/qwik_test";
    process.env.JWT_SECRET ??= "test-jwt-secret-value-0123456789";
    process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-value-0123456789";
    process.env.TASNIF_BASE_URL = "http://127.0.0.1:9"; // nothing listens there: refused at once
    const { liveTasnif, nationalPaused } = await import("../src/modules/catalog/catalog.tasnif.js");

    expect(nationalPaused()).toBe(false);
    expect((await liveTasnif("5449000000996")).complete).toBe(false);
    expect((await liveTasnif("5449000000996")).complete).toBe(false);
    expect(nationalPaused()).toBe(true); // two failures: not asking any more

    const started = Date.now();
    expect(await liveTasnif("5449000000996")).toEqual({ product: null, complete: false });
    expect(Date.now() - started).toBeLessThan(50);
  });
});
