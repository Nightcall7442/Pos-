import { Request, Response } from "express";
import { reportService } from "./report.service.js";
import { sendSuccess, sendError } from "../../utils/response.js";
import { handleError } from "../../utils/errors.js";

export class ReportController {
  async getDashboard(req: Request, res: Response) {
    try {
      const dashboard = await reportService.getDashboard(req.user!.tenantId);
      sendSuccess(res, dashboard);
    } catch (error) {
      handleError(res, error);
    }
  }

  async getSalesReport(req: Request, res: Response) {
    try {
      const { dateFrom, dateTo } = req.query;
      if (!dateFrom || !dateTo) {
        return sendError(res, "dateFrom and dateTo are required");
      }
      const report = await reportService.getSalesReport(
        req.user!.tenantId,
        dateFrom as string,
        dateTo as string
      );
      sendSuccess(res, report);
    } catch (error) {
      handleError(res, error);
    }
  }

  async getEmployeeReport(req: Request, res: Response) {
    try {
      const { dateFrom, dateTo } = req.query;
      if (!dateFrom || !dateTo) {
        return sendError(res, "dateFrom and dateTo are required");
      }
      const report = await reportService.getEmployeeReport(
        req.user!.tenantId,
        dateFrom as string,
        dateTo as string
      );
      sendSuccess(res, report);
    } catch (error) {
      handleError(res, error);
    }
  }
}

export const reportController = new ReportController();
