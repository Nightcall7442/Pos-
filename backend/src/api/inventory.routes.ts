import { Router } from "express";
import { inventoryController } from "../modules/inventory/inventory.controller.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { auditLog } from "../middleware/audit.js";
import { adjustStockSchema, inventoryQuerySchema, movementQuerySchema } from "../modules/common.schema.js";

const router = Router();

router.use(authenticate);

router.get("/stock", validate(inventoryQuerySchema, "query"), (req, res) => inventoryController.getStock(req, res));
router.get("/movements", validate(movementQuerySchema, "query"), (req, res) => inventoryController.getMovements(req, res));
router.get("/alerts", (req, res) => inventoryController.getLowStockAlerts(req, res));
router.post("/:id/adjust", authorize("admin", "manager"), validate(adjustStockSchema), auditLog("inventory.adjust", "product"), (req, res) => inventoryController.adjustStock(req, res));

export default router;
