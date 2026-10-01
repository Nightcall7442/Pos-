import { Request, Response } from "express";
import { categoryService } from "./category.service.js";
import { sendSuccess, sendCreated } from "../../utils/response.js";
import { handleError } from "../../utils/errors.js";

export class CategoryController {
  async findAll(req: Request, res: Response) {
    try {
      const categories = await categoryService.findAll(req.user!.tenantId);
      sendSuccess(res, categories);
    } catch (error) {
      handleError(res, error);
    }
  }

  async findTree(req: Request, res: Response) {
    try {
      const categories = await categoryService.findTree(req.user!.tenantId);
      sendSuccess(res, categories);
    } catch (error) {
      handleError(res, error);
    }
  }

  async findById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const category = await categoryService.findById(req.user!.tenantId, id);
      sendSuccess(res, category);
    } catch (error) {
      handleError(res, error, 404);
    }
  }

  async create(req: Request, res: Response) {
    try {
      const category = await categoryService.create(req.user!.tenantId, req.body);
      sendCreated(res, category);
    } catch (error) {
      handleError(res, error);
    }
  }

  async update(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const category = await categoryService.update(req.user!.tenantId, id, req.body);
      sendSuccess(res, category);
    } catch (error) {
      handleError(res, error);
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      await categoryService.delete(req.user!.tenantId, id);
      sendSuccess(res, null, "Category deleted");
    } catch (error) {
      handleError(res, error);
    }
  }

  async reorder(req: Request, res: Response) {
    try {
      await categoryService.reorder(req.user!.tenantId, req.body.ids);
      sendSuccess(res, null, "Categories reordered");
    } catch (error) {
      handleError(res, error);
    }
  }
}

export const categoryController = new CategoryController();
