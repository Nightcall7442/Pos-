import prisma from "../../config/database.js";
import type { CreatePaymentInput } from "./payment.schema.js";
import { deductTechCardIngredients, round2 } from "../inventory/stock.helpers.js";
import { optionalDateFilter, tenantTimeZone } from "../../utils/dates.js";
import { AppError, ConflictError, NotFoundError } from "../../utils/errors.js";

export class PaymentService {
  async create(tenantId: string, data: CreatePaymentInput, userId?: string) {
    const order = await prisma.order.findFirst({
      where: { id: data.orderId, tenantId },
      include: { payments: true },
    });
    if (!order) throw new NotFoundError("Заказ не найден");
    if (order.status === "cancelled") throw new ConflictError("Нельзя оплатить отменённый заказ");
    if (order.status === "completed") throw new ConflictError("Заказ уже оплачен");

    const totalPaid = order.payments
      .filter((p) => p.status === "completed")
      .reduce((sum, p) => sum + p.amount, 0);
    const remaining = round2(order.total - totalPaid);

    if (data.amount > remaining + 0.01) {
      throw new AppError(`Сумма превышает остаток к оплате ${remaining.toFixed(2)}`);
    }
    if (data.amount < remaining - 0.01 && !data.allowPartial) {
      throw new Error(`Сумма ${data.amount.toFixed(2)} меньше остатка к оплате ${remaining.toFixed(2)}`);
    }

    const completesOrder = totalPaid + data.amount >= order.total - 0.01;

    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          tenantId,
          orderId: data.orderId,
          method: data.method,
          amount: data.amount,
          tipAmount: data.tipAmount || 0,
          transactionId: data.transactionId,
          cardLastFour: data.cardLastFour,
          status: "completed",
          processedAt: new Date(),
        },
      });

      if (completesOrder) {
        await tx.order.update({
          where: { id: data.orderId },
          data: { status: "completed", completedAt: new Date() },
        });

        // The product's own stock was reserved when the order was created;
        // here only the recipe ingredients are written off.
        await deductTechCardIngredients(tx, { tenantId, userId, orderId: data.orderId });

        if (order.tableId) {
          await tx.table.update({
            where: { id: order.tableId },
            data: { status: "available" },
          });
        }
      }

      return payment;
    });
  }

  async findAll(tenantId: string, query: any) {
    const { page = 1, limit = 20, method, status, orderId } = query;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (method) where.method = method;
    if (status) where.status = status;
    if (orderId) where.orderId = orderId;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          order: { select: { id: true, orderNumber: true, total: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    return { payments, total, page, limit };
  }

  async refund(tenantId: string, paymentId: string, reason: string) {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, tenantId, status: "completed" },
      include: { order: { include: { payments: true } } },
    });
    if (!payment) throw new NotFoundError("Платёж не найден");

    // Причину возврата требует refundPaymentSchema, контроллер передаёт её
    // сюда — и до сих пути она терялась: в платёж не писалась, а в журнал
    // аудита не попадала (middleware/audit сохраняет data из ответа, где
    // причины нет). Теперь она лежит в metadata платежа вместе с временем.
    let metadata: Record<string, unknown> = {};
    try {
      const parsed: unknown = JSON.parse(payment.metadata || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        metadata = parsed as Record<string, unknown>;
      }
    } catch {
      // битый JSON в metadata не должен ломать возврат
    }

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "refunded",
        metadata: JSON.stringify({
          ...metadata,
          refund: { reason, at: new Date().toISOString() },
        }),
      },
    });

    const order = payment.order;
    const otherCompletedPayments = order.payments.filter(
      (p) => p.id !== paymentId && p.status === "completed"
    );
    const totalPaidAfterRefund = otherCompletedPayments.reduce((sum, p) => sum + p.amount, 0);

    if (totalPaidAfterRefund < order.total - 0.01 && order.status === "completed") {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "served", completedAt: null },
      });

      if (order.tableId) {
        await prisma.table.update({
          where: { id: order.tableId },
          data: { status: "occupied" },
        });
      }
    }

    return updated;
  }

  async getSummary(tenantId: string, dateFrom?: string, dateTo?: string) {
    const where: any = { tenantId, status: "completed" };
    const createdAt = optionalDateFilter(dateFrom, dateTo, await tenantTimeZone(tenantId));
    if (createdAt) where.createdAt = createdAt;

    const [payments, totalRevenue, totalTips, byMethod] = await Promise.all([
      prisma.payment.findMany({ where }),
      prisma.payment.aggregate({ where, _sum: { amount: true } }),
      prisma.payment.aggregate({ where, _sum: { tipAmount: true } }),
      prisma.payment.groupBy({
        by: ["method"],
        where,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      totalRevenue: totalRevenue._sum.amount || 0,
      totalTips: totalTips._sum.tipAmount || 0,
      totalTransactions: payments.length,
      byMethod: byMethod.map((m) => ({
        method: m.method,
        total: m._sum.amount || 0,
        count: m._count,
      })),
    };
  }
}

export const paymentService = new PaymentService();
