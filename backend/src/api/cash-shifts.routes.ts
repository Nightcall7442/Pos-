import { Router } from "express";
import { cashShiftController } from "../modules/cash-shifts/cash-shift.controller.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { auditLog } from "../middleware/audit.js";
import { openShiftSchema, closeShiftSchema, shiftQuerySchema } from "../modules/cash-shifts/cash-shift.schema.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize("admin", "manager"), validate(shiftQuerySchema, "query"), (req, res) => cashShiftController.findAll(req, res));
router.get("/current", (req, res) => cashShiftController.getCurrentShift(req, res));
router.get("/:id", (req, res) => cashShiftController.findById(req, res));
router.post("/open", validate(openShiftSchema), auditLog("shift.open", "cash_shift"), (req, res) => cashShiftController.openShift(req, res));
router.post("/:id/close", validate(closeShiftSchema), auditLog("shift.close", "cash_shift"), (req, res) => cashShiftController.closeShift(req, res));

export default router;
