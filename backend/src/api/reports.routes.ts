import { Router } from "express";
import { reportController } from "../modules/reports/report.controller.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { reportQuerySchema } from "../modules/common.schema.js";

const router = Router();

router.use(authenticate);

router.get("/dashboard", (req, res) => reportController.getDashboard(req, res));
router.get("/sales", authorize("admin", "manager"), validate(reportQuerySchema, "query"), (req, res) => reportController.getSalesReport(req, res));
router.get("/employees", authorize("admin", "manager"), validate(reportQuerySchema, "query"), (req, res) => reportController.getEmployeeReport(req, res));

export default router;
