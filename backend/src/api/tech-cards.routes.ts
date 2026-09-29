import { Router } from "express";
import { techCardController } from "../modules/tech-cards/tech-card.controller.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { auditLog } from "../middleware/audit.js";
import { createTechCardSchema, updateTechCardSchema, techCardQuerySchema } from "../modules/tech-cards/tech-card.schema.js";

const router = Router();

router.use(authenticate);

router.get("/", validate(techCardQuerySchema, "query"), (req, res) => techCardController.findAll(req, res));
router.get("/:id", (req, res) => techCardController.findById(req, res));
router.post("/", authorize("admin", "manager"), validate(createTechCardSchema), auditLog("tech_card.create", "tech_card"), (req, res) => techCardController.create(req, res));
router.put("/:id", authorize("admin", "manager"), validate(updateTechCardSchema), auditLog("tech_card.update", "tech_card"), (req, res) => techCardController.update(req, res));
router.delete("/:id", authorize("admin", "manager"), auditLog("tech_card.delete", "tech_card"), (req, res) => techCardController.delete(req, res));
router.post("/:id/copy", authorize("admin", "manager"), auditLog("tech_card.copy", "tech_card"), (req, res) => techCardController.copy(req, res));
router.post("/:id/recalculate", authorize("admin", "manager"), auditLog("tech_card.recalculate", "tech_card"), (req, res) => techCardController.recalculateCost(req, res));

export default router;
