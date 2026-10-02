import type { Tx } from "../inventory/stock.helpers.js";

export interface LockedOrder {
  id: string;
  status: string;
  total: number;
  tableId: string | null;
}

/**
 * Блокирует строку заказа до конца транзакции и возвращает его состояние на
 * момент после блокировки. Оплата, отмена, смена статуса и фоновая отмена
 * неоплаченных заказов берут эту блокировку первой — и поэтому идут по
 * очереди, каждая видя, что сделала предыдущая. Раньше они проверяли статус
 * до транзакции: две одновременные оплаты обе видели «не оплачен» и обе
 * проходили.
 *
 * Порядок блокировок во всём коде один: заказ → товары (lockStockRows) → стол.
 * FOR NO KEY UPDATE — потому что вставка платежа со ссылкой на заказ берёт на
 * нём KEY SHARE, а FOR UPDATE с ней конфликтовал бы.
 *
 * skipLocked: строку, которую сейчас держит другая транзакция, пропустить, а не
 * ждать (для фоновой отмены — заказ, который прямо сейчас оплачивают, не её).
 */
export async function lockOrder(
  tx: Tx,
  tenantId: string,
  orderId: string,
  options: { skipLocked?: boolean } = {}
): Promise<LockedOrder | null> {
  const rows = options.skipLocked
    ? await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM orders WHERE id = ${orderId} AND tenant_id = ${tenantId} FOR NO KEY UPDATE SKIP LOCKED`
    : await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM orders WHERE id = ${orderId} AND tenant_id = ${tenantId} FOR NO KEY UPDATE`;
  if (rows.length === 0) return null;
  // Читаем уже после блокировки: это последнее зафиксированное состояние.
  return tx.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, total: true, tableId: true },
  });
}
