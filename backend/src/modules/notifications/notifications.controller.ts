import { Request, Response } from "express";
import { notificationsService } from "./notifications.service.js";
import { sendSuccess } from "../../utils/response.js";
import { handleError } from "../../utils/errors.js";

export class NotificationsController {
  async get(req: Request, res: Response) {
    try {
      const data = await notificationsService.getNotifications(req.user!.tenantId);
      sendSuccess(res, data);
    } catch (error) {
      handleError(res, error);
    }
  }
}

export const notificationsController = new NotificationsController();
