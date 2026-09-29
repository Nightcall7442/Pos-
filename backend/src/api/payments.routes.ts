import { Router } from "express";
import { paymentController } from "../modules/payments/payment.controller.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { paymentQuerySchema, paymentSummaryQuerySchema } from "../modules/common.schema.js";
import { auditLog } from "../middleware/audit.js";
import { createPaymentSchema, refundPaymentSchema } from "../modules/payments/payment.schema.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize("admin", "manager"), validate(paymentQuerySchema, "query"), (req, res) => paymentController.findAll(req, res));
router.get("/summary", authorize("admin", "manager"), validate(paymentSummaryQuerySchema, "query"), (req, res) => paymentController.getSummary(req, res));
router.post("/", authorize("admin", "manager", "cashier"), validate(createPaymentSchema), auditLog("payment.create", "payment"), (req, res) => paymentController.create(req, res));
router.post("/:id/refund", authorize("admin", "manager"), validate(refundPaymentSchema), auditLog("payment.refund", "payment"), (req, res) => paymentController.refund(req, res));

export default router;
