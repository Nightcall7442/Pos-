// The national catalogue of Uzbekistan (tasnif.soliq.uz) answers a browser in Uzbekistan in a third
// of a second and lets any site ask it — which a server in a foreign data centre cannot count on
// (Railway's is turned away). So the shop's own browser asks it, and hands the record to the
// server, which turns it into a name, a pack size, a shelf and the IKPU. Any failure is silence:
// the catalogue is a help, never a condition.
const NATIONAL_URL = "https://tasnif.soliq.uz/api/cls-api/mxik/search/by-params";
const NATIONAL_TIMEOUT_MS = 2500;

export async function fetchNational(code: string): Promise<Record<string, unknown> | null> {
  if (!/^\d{8,14}$/.test(code)) return null;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), NATIONAL_TIMEOUT_MS);
  try {
    const res = await fetch(`${NATIONAL_URL}?gtin=${code}&size=3&lang=ru`, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const content = (await res.json())?.data?.content;
    return Array.isArray(content) ? (content.find((record) => record && typeof record.mxikCode === "string") ?? null) : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}
