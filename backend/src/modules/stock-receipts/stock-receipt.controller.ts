import { Request, Response } from "express";
import { stockReceiptService } from "./stock-receipt.service.js";
import { sendSuccess, sendError, sendPaginated } from "../../utils/response.js";
import { handleError } from "../../utils/errors.js";

export class StockReceiptController {
  async create(req: Request, res: Response) {
    try {
      const receipt = await stockReceiptService.create(
        req.user!.tenantId,
        req.user!.id,
        req.body
      );
      sendSuccess(res, receipt, "Приход создан", 201);
    } catch (error) {
      handleError(res, error);
    }
  }

  async findAll(req: Request, res: Response) {
    try {
      const { receipts, total, page, limit } = await stockReceiptService.findAll(req.user!.tenantId, {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        supplierName: req.query.supplierName as string,
      });
      sendPaginated(res, receipts, total, page, limit);
    } catch (error) {
      handleError(res, error);
    }
  }

  async findById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const receipt = await stockReceiptService.findById(req.user!.tenantId, id);
      sendSuccess(res, receipt);
    } catch (error) {
      handleError(res, error, 404);
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      await stockReceiptService.delete(req.user!.tenantId, id, req.user!.id);
      sendSuccess(res, null, "Приход удалён");
    } catch (error) {
      handleError(res, error);
    }
  }
}

export const stockReceiptController = new StockReceiptController();
