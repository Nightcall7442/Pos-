import { Request, Response } from "express";
import { paymentService } from "./payment.service.js";
import { sendSuccess, sendCreated, sendError, sendPaginated } from "../../utils/response.js";
import { handleError } from "../../utils/errors.js";

export class PaymentController {
  async create(req: Request, res: Response) {
    try {
      const payment = await paymentService.create(req.user!.tenantId, req.body, req.user!.id);
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
        method: req.query.method as string,
        status: req.query.status as string,
        orderId: req.query.orderId as string,
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
