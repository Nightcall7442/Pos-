import { Request, Response } from "express";
import { settingsService } from "./settings.service.js";
import { sendSuccess, sendError } from "../../utils/response.js";
import { handleError } from "../../utils/errors.js";

export class SettingsController {
  async get(req: Request, res: Response) {
    try {
      const settings = await settingsService.get(req.user!.tenantId);
      sendSuccess(res, settings);
    } catch (error) {
      handleError(res, error);
    }
  }

  async update(req: Request, res: Response) {
    try {
      const settings = await settingsService.update(req.user!.tenantId, req.body);
      sendSuccess(res, settings);
    } catch (error) {
      handleError(res, error);
    }
  }
}

export const settingsController = new SettingsController();
