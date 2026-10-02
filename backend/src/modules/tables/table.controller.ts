import { Request, Response } from "express";
import { tableService } from "./table.service.js";
import { sendSuccess, sendCreated } from "../../utils/response.js";
import { handleError } from "../../utils/errors.js";

export class TableController {
  async findAll(req: Request, res: Response) {
    try {
      const tables = await tableService.findAll(req.user!.tenantId, req.query.branchId as string);
      sendSuccess(res, tables);
    } catch (error) {
      handleError(res, error);
    }
  }

  async findById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const table = await tableService.findById(req.user!.tenantId, id);
      sendSuccess(res, table);
    } catch (error) {
      handleError(res, error, 404);
    }
  }

  async create(req: Request, res: Response) {
    try {
      const table = await tableService.create(req.user!.tenantId, req.body);
      sendCreated(res, table);
    } catch (error) {
      handleError(res, error);
    }
  }

  async update(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const table = await tableService.update(req.user!.tenantId, id, req.body);
      sendSuccess(res, table);
    } catch (error) {
      handleError(res, error);
    }
  }

  async updateStatus(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const table = await tableService.updateStatus(req.user!.tenantId, id, req.body.status);
      sendSuccess(res, table);
    } catch (error) {
      handleError(res, error);
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      await tableService.delete(req.user!.tenantId, id);
      sendSuccess(res, null, "Table deleted");
    } catch (error) {
      handleError(res, error);
    }
  }

  async getStats(req: Request, res: Response) {
    try {
      const stats = await tableService.getStats(req.user!.tenantId);
      sendSuccess(res, stats);
    } catch (error) {
      handleError(res, error);
    }
  }
}

export const tableController = new TableController();
