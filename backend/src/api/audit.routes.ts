import { Router } from "express";
import { auditController } from "../modules/audit/audit.controller.js";
import { auditQuerySchema } from "../modules/common.schema.js";
import { validate } from "../middleware/validate.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);
router.use(authorize("admin", "manager"));

router.get("/", validate(auditQuerySchema, "query"), (req, res) => auditController.findAll(req, res));

export default router;
