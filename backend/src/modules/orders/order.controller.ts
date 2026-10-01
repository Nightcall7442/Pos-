import { Request, Response } from "express";
import { orderService, OrderTotalChangedError } from "./order.service.js";
import { sendSuccess, sendCreated, sendPaginated } from "../../utils/response.js";
import { handleError } from "../../utils/errors.js";
import type { OrderQueryInput } from "./order.schema.js";

export class OrderController {
  async findAll(req: Request, res: Response) {
    try {
      const query = req.query as unknown as OrderQueryInput;
      const { orders, total, page, limit } = await orderService.findAll(req.user!.tenantId, query);
      sendPaginated(res, orders, total, page, limit);
    } catch (error) {
      handleError(res, error);
    }
  }

  async findById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const order = await orderService.findById(req.user!.tenantId, id);
      sendSuccess(res, order);
    } catch (error) {
      handleError(res, error, 404);
    }
  }

  async create(req: Request, res: Response) {
    try {
      const order = await orderService.create(req.user!.tenantId, req.user!.id, req.body);
      sendCreated(res, order);
    } catch (error) {
      handleError(res, error);
    }
  }

  async checkout(req: Request, res: Response) {
    try {
      const order = await orderService.checkout(req.user!.tenantId, req.user!.id, req.body);
      sendCreated(res, order);
    } catch (error) {
      if (error instanceof OrderTotalChangedError) {
        res.status(409).json({ success: false, error: error.message, actualTotal: error.actualTotal });
        return;
      }
      handleError(res, error);
    }
  }

  async updateStatus(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const order = await orderService.updateStatus(req.user!.tenantId, id, req.body);
      sendSuccess(res, order);
    } catch (error) {
      handleError(res, error);
    }
  }

  async cancel(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const order = await orderService.cancel(req.user!.tenantId, id, req.user!.id);
      sendSuccess(res, order);
    } catch (error) {
      handleError(res, error);
    }
  }

  async getActive(req: Request, res: Response) {
    try {
      const branchId = req.query.branchId as string | undefined;
      const orders = await orderService.getActiveOrders(req.user!.tenantId, branchId);
      sendSuccess(res, orders);
    } catch (error) {
      handleError(res, error);
    }
  }
}

export const orderController = new OrderController();
