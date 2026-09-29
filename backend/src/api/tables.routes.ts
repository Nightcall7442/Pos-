import { Router } from "express";
import { tableController } from "../modules/tables/table.controller.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { auditLog } from "../middleware/audit.js";
import { createTableSchema, updateTableSchema, updateTableStatusSchema } from "../modules/tables/table.schema.js";

const router = Router();

router.use(authenticate);

router.get("/", (req, res) => tableController.findAll(req, res));
router.get("/stats", (req, res) => tableController.getStats(req, res));
router.get("/:id", (req, res) => tableController.findById(req, res));
router.post("/", authorize("admin", "manager"), validate(createTableSchema), auditLog("table.create", "table"), (req, res) => tableController.create(req, res));
router.put("/:id", authorize("admin", "manager"), validate(updateTableSchema), auditLog("table.update", "table"), (req, res) => tableController.update(req, res));
router.patch("/:id/status", validate(updateTableStatusSchema), auditLog("table.status", "table"), (req, res) => tableController.updateStatus(req, res));
router.delete("/:id", authorize("admin", "manager"), auditLog("table.delete", "table"), (req, res) => tableController.delete(req, res));

export default router;
