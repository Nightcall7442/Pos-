import type { PaymentQueryInput } from "../common.schema.js";
import { Request, Response } from "express";
import { paymentService } from "./payment.service.js";
import { sendSuccess, sendCreated, sendPaginated } from "../../utils/response.js";
import { handleError } from "../../utils/errors.js";
import prisma from "../../config/database.js";
import { idempotencyFrom, withIdempotency } from "../../utils/idempotency.js";

export class PaymentController {
  async create(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const idem = idempotencyFrom(req, "POST /payments");
      // Повтор с тем же Idempotency-Key отвечает тем, что создал первый запрос.
      const { value: payment, replayed } = await withIdempotency(
        tenantId,
        idem,
        () => paymentService.create(tenantId, req.body, req.user!.id, idem),
        (id) => prisma.payment.findFirstOrThrow({ where: { id, tenantId } })
      );
      if (replayed) res.setHeader("Idempotent-Replayed", "true");
      sendCreated(res, payment);
    } catch (error) {
      handleError(res, error);
    }
  }

  async findAll(req: Request, res: Response) {
    try {
      const query = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
        method: req.query.method as PaymentQueryInput["method"],
        status: req.query.status as PaymentQueryInput["status"],
        orderId: req.query.orderId as string | undefined,
      };
      const { payments, total, page, limit } = await paymentService.findAll(req.user!.tenantId, query);
      sendPaginated(res, payments, total, page, limit);
    } catch (error) {
      handleError(res, error);
    }
  }

  async refund(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const payment = await paymentService.refund(req.user!.tenantId, id, req.body.reason);
      sendSuccess(res, payment, "Payment refunded");
    } catch (error) {
      handleError(res, error);
    }
  }

  async getSummary(req: Request, res: Response) {
    try {
      const summary = await paymentService.getSummary(
        req.user!.tenantId,
        req.query.dateFrom as string,
        req.query.dateTo as string
      );
      sendSuccess(res, summary);
    } catch (error) {
      handleError(res, error);
    }
  }
}

export const paymentController = new PaymentController();
