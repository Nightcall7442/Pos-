import { Request, Response } from "express";
import { authService } from "./auth.service.js";
import { sendSuccess, sendError } from "../../utils/response.js";
import { handleError } from "../../utils/errors.js";

export class AuthController {
  async login(req: Request, res: Response) {
    try {
      const tenantId = req.headers["x-tenant-id"] as string | undefined;
      const result = await authService.login(req.body, tenantId);
      sendSuccess(res, result, "Login successful");
    } catch (error) {
      handleError(res, error, 401);
    }
  }

  async register(req: Request, res: Response) {
    try {
      const result = await authService.register(req.body);
      sendSuccess(res, result, "Registration successful", 201);
    } catch (error) {
      handleError(res, error, 400);
    }
  }

  async refreshToken(req: Request, res: Response) {
    try {
      const result = await authService.refreshToken(req.body.refreshToken);
      sendSuccess(res, result, "Token refreshed");
    } catch (error) {
      handleError(res, error, 401);
    }
  }

  async changePassword(req: Request, res: Response) {
    try {
      const result = await authService.changePassword(
        req.user!.id,
        req.body.currentPassword,
        req.body.newPassword
      );
      sendSuccess(res, result);
    } catch (error) {
      handleError(res, error, 400);
    }
  }

  async me(req: Request, res: Response) {
    sendSuccess(res, req.user);
  }
}

export const authController = new AuthController();
