import { Request, Response } from "express";
import { sendCreated, sendSuccess } from "../../utils/response.js";
import { handleError } from "../../utils/errors.js";
import { catalogService } from "./catalog.service.js";

export class CatalogController {
  async lookup(req: Request, res: Response) {
    try {
      sendSuccess(res, await catalogService.lookup(String(req.query.code)));
    } catch (error) {
      handleError(res, error);
    }
  }

  async add(req: Request, res: Response) {
    try {
      sendCreated(res, await catalogService.add(req.user!.tenantId, req.body));
    } catch (error) {
      handleError(res, error);
    }
  }

  async stats(_req: Request, res: Response) {
    try {
      sendSuccess(res, await catalogService.stats());
    } catch (error) {
      handleError(res, error);
    }
  }
}

export const catalogController = new CatalogController();
