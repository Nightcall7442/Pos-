import { Router } from "express";
import { categoryController } from "../modules/categories/category.controller.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { auditLog } from "../middleware/audit.js";
import { createCategorySchema, updateCategorySchema } from "../modules/categories/category.schema.js";
import { reorderCategoriesSchema } from "../modules/common.schema.js";

const router = Router();

router.use(authenticate);

router.get("/", (req, res) => categoryController.findAll(req, res));
router.get("/tree", (req, res) => categoryController.findTree(req, res));
router.get("/:id", (req, res) => categoryController.findById(req, res));
router.post("/", authorize("admin", "manager"), validate(createCategorySchema), auditLog("category.create", "category"), (req, res) => categoryController.create(req, res));
router.put("/:id", authorize("admin", "manager"), validate(updateCategorySchema), auditLog("category.update", "category"), (req, res) => categoryController.update(req, res));
router.delete("/:id", authorize("admin", "manager"), auditLog("category.delete", "category"), (req, res) => categoryController.delete(req, res));
router.post("/reorder", authorize("admin", "manager"), validate(reorderCategoriesSchema), auditLog("category.reorder", "category"), (req, res) => categoryController.reorder(req, res));

export default router;
