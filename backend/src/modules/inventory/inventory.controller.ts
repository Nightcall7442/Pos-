import { Request, Response } from "express";
import { inventoryService } from "./inventory.service.js";
import { sendSuccess, sendPaginated } from "../../utils/response.js";
import { handleError } from "../../utils/errors.js";

export class InventoryController {
  async getStock(req: Request, res: Response) {
    try {
      const { products, total, page, limit } = await inventoryService.getStock(req.user!.tenantId, {
        lowStock: req.query.lowStock as unknown as boolean | undefined,
        categoryId: req.query.categoryId,
        search: req.query.search,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      });
      sendPaginated(res, products, total, page, limit);
    } catch (error) {
      handleError(res, error);
    }
  }

  async getMovements(req: Request, res: Response) {
    try {
      const { movements, total, page, limit } = await inventoryService.getMovements(req.user!.tenantId, {
        productId: req.query.productId,
        type: req.query.type,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      });
      sendPaginated(res, movements, total, page, limit);
    } catch (error) {
      handleError(res, error);
    }
  }

  async adjustStock(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const product = await inventoryService.adjustStock(
        req.user!.tenantId,
        id,
        req.body.quantity,
        req.body.reason,
        req.user!.id
      );
      sendSuccess(res, product);
    } catch (error) {
      handleError(res, error);
    }
  }

  async getLowStockAlerts(req: Request, res: Response) {
    try {
      const products = await inventoryService.getLowStockAlerts(req.user!.tenantId);
      sendSuccess(res, products);
    } catch (error) {
      handleError(res, error);
    }
  }
}

export const inventoryController = new InventoryController();
