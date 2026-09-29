// Calendar-day helpers that respect the tenant's IANA timezone. Report
// filters arrive as plain "YYYY-MM-DD" strings from the admin panel; treating
// them as UTC instants cut off everything after local midnight and made the
// "today" report empty for anyone east of Greenwich.

import prisma from "../config/database.js";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidTimeZone(timeZone: string | null | undefined): timeZone is string {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function safeTimeZone(timeZone: string | null | undefined): string {
  return isValidTimeZone(timeZone) ? timeZone : "UTC";
}

function zonedParts(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, number> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return parts;
}

// Offset of `timeZone` from UTC at the given instant, in milliseconds.
function tzOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// UTC instant of local midnight for a "YYYY-MM-DD" day in `timeZone`.
export function zonedDayStart(day: string, timeZone: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let result = guess - tzOffsetMs(new Date(guess), timeZone);
  // Re-evaluate once in case the offset changed across a DST boundary.
  const offset2 = tzOffsetMs(new Date(result), timeZone);
  if (guess - offset2 !== result) result = guess - offset2;
  return new Date(result);
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// "YYYY-MM-DD" of the current calendar day in `timeZone`.
export function todayInZone(timeZone: string, now: Date = new Date()): string {
  const p = zonedParts(now, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function firstOfMonthInZone(timeZone: string, now: Date = new Date()): string {
  return todayInZone(timeZone, now).slice(0, 8) + "01";
}

// Two-digit local hour of an instant in `timeZone`.
export function hourInZone(date: Date, timeZone: string): string {
  return String(zonedParts(date, timeZone).hour).padStart(2, "0");
}

// Inclusive calendar range → half-open UTC interval [start, end).
// Plain days are interpreted in `timeZone`; full ISO timestamps are used as-is.
export function dateRange(dateFrom: string, dateTo: string, timeZone: string): { start: Date; end: Date } {
  const start = DAY_RE.test(dateFrom) ? zonedDayStart(dateFrom, timeZone) : new Date(dateFrom);
  const end = DAY_RE.test(dateTo) ? zonedDayStart(addDays(dateTo, 1), timeZone) : new Date(dateTo);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Некорректный диапазон дат");
  }
  if (end <= start) throw new Error("Дата окончания раньше даты начала");
  return { start, end };
}

// Optional list filters (?dateFrom=&dateTo=) with the same day semantics as
// dateRange; returns a Prisma `createdAt` condition or undefined.
export function optionalDateFilter(
  dateFrom: string | undefined,
  dateTo: string | undefined,
  timeZone: string
): { gte?: Date; lt?: Date } | undefined {
  if (!dateFrom && !dateTo) return undefined;
  const filter: { gte?: Date; lt?: Date } = {};
  if (dateFrom) filter.gte = DAY_RE.test(dateFrom) ? zonedDayStart(dateFrom, timeZone) : new Date(dateFrom);
  if (dateTo) filter.lt = DAY_RE.test(dateTo) ? zonedDayStart(addDays(dateTo, 1), timeZone) : new Date(dateTo);
  for (const v of Object.values(filter)) {
    if (v && Number.isNaN(v.getTime())) throw new Error("Некорректная дата");
  }
  return filter;
}

export async function tenantTimeZone(tenantId: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } });
  return safeTimeZone(tenant?.timezone);
}
