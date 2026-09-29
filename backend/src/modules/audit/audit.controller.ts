import { Request, Response } from "express";
import { auditService } from "./audit.service.js";
import { sendSuccess, sendError, sendPaginated } from "../../utils/response.js";
import { handleError } from "../../utils/errors.js";

export class AuditController {
  async findAll(req: Request, res: Response) {
    try {
      const { logs, total, page, limit } = await auditService.findAll(req.user!.tenantId, {
        userId: req.query.userId as string,
        entityType: req.query.entityType as string,
        action: req.query.action as string,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      });
      sendPaginated(res, logs, total, page, limit);
    } catch (error) {
      handleError(res, error);
    }
  }
}

export const auditController = new AuditController();
