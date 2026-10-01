import { Prisma } from "@prisma/client";
import prisma from "../config/database.js";
import type { Tx } from "../modules/inventory/stock.helpers.js";

// Postgres прерывает одну из транзакций, если две ждут друг друга
// (deadlock, 40P01) или если сериализация невозможна (40001). Это не ошибка
// данных: вторая транзакция уже отпустила блокировки, и повтор с начала
// проходит. На SQLite такого не бывало — писатель там один.
function isRetryable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2034") return true;
    if (error.code === "P2010") {
      const code = (error.meta as { code?: string } | undefined)?.code;
      return code === "40P01" || code === "40001";
    }
  }
  const message = error instanceof Error ? error.message : "";
  return /\b40P01\b|\b40001\b|deadlock detected|could not serialize access/i.test(message);
}

/**
 * prisma.$transaction с повтором при взаимной блокировке. Колбэк выполняется
 * заново целиком, поэтому в нём не должно быть побочных эффектов вне базы
 * (сокеты, письма) — их делают после.
 */
export async function inTransaction<T>(
  fn: (tx: Tx) => Promise<T>,
  options?: { maxWait?: number; timeout?: number },
  attempts = 3
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(fn, options);
    } catch (error) {
      if (attempt >= attempts || !isRetryable(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 80 * attempt));
    }
  }
}
