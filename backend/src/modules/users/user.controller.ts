import { Request, Response } from "express";
import { userService } from "./user.service.js";
import { sendSuccess, sendCreated, sendPaginated } from "../../utils/response.js";
import { handleError } from "../../utils/errors.js";

export class UserController {
  async findAll(req: Request, res: Response) {
    try {
      const { users, total, page, limit } = await userService.findAll(req.user!.tenantId, req.query);
      sendPaginated(res, users, total, page, limit);
    } catch (error) {
      handleError(res, error);
    }
  }

  async findById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const user = await userService.findById(req.user!.tenantId, id);
      sendSuccess(res, user);
    } catch (error) {
      handleError(res, error, 404);
    }
  }

  async create(req: Request, res: Response) {
    try {
      const user = await userService.create(req.user!.tenantId, req.body, req.user!.role);
      sendCreated(res, user);
    } catch (error) {
      handleError(res, error);
    }
  }

  async update(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const user = await userService.update(req.user!.tenantId, id, req.body, req.user!.role);
      sendSuccess(res, user);
    } catch (error) {
      handleError(res, error);
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      await userService.delete(req.user!.tenantId, id);
      sendSuccess(res, null, "User deactivated");
    } catch (error) {
      handleError(res, error);
    }
  }

  async toggleActive(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const user = await userService.toggleActive(req.user!.tenantId, id, { id: req.user!.id, role: req.user!.role });
      sendSuccess(res, user);
    } catch (error) {
      handleError(res, error);
    }
  }
}

export const userController = new UserController();
