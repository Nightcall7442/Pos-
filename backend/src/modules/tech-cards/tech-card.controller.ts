import { Request, Response } from "express";
import { techCardService } from "./tech-card.service.js";
import { sendSuccess, sendCreated, sendPaginated } from "../../utils/response.js";
import { handleError } from "../../utils/errors.js";
import type { TechCardQueryInput } from "./tech-card.schema.js";

export class TechCardController {
  async findAll(req: Request, res: Response) {
    try {
      const query: TechCardQueryInput = {
        search: req.query.search as string,
        isActive: req.query.isActive as unknown as boolean | undefined,
        sort: (req.query.sort as TechCardQueryInput["sort"]) || "name",
        order: (req.query.order as TechCardQueryInput["order"]) || "asc",
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      };
      const { techCards, total, page, limit } = await techCardService.findAll(req.user!.tenantId, query);
      sendPaginated(res, techCards, total, page, limit);
    } catch (error) {
      handleError(res, error);
    }
  }

  async findById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const techCard = await techCardService.findById(req.user!.tenantId, id);
      sendSuccess(res, techCard);
    } catch (error) {
      handleError(res, error, 404);
    }
  }

  async create(req: Request, res: Response) {
    try {
      const techCard = await techCardService.create(req.user!.tenantId, req.body);
      sendCreated(res, techCard);
    } catch (error) {
      handleError(res, error);
    }
  }

  async update(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const techCard = await techCardService.update(req.user!.tenantId, id, req.body);
      sendSuccess(res, techCard);
    } catch (error) {
      handleError(res, error);
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      await techCardService.delete(req.user!.tenantId, id);
      sendSuccess(res, null, "Tech card deleted");
    } catch (error) {
      handleError(res, error);
    }
  }

  async copy(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const techCard = await techCardService.copy(req.user!.tenantId, id);
      sendCreated(res, techCard);
    } catch (error) {
      handleError(res, error);
    }
  }

  async recalculateCost(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const techCard = await techCardService.recalculateCost(req.user!.tenantId, id);
      sendSuccess(res, techCard);
    } catch (error) {
      handleError(res, error);
    }
  }
}

export const techCardController = new TechCardController();
