import { Router } from "express";
import { settingsController } from "../modules/settings/settings.controller.js";
import { auditLog } from "../middleware/audit.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", (req, res) => settingsController.get(req, res));
router.put("/", authorize("admin", "manager"), auditLog("settings.update", "tenant"), (req, res) => settingsController.update(req, res));

export default router;
