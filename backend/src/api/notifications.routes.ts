import { Router } from "express";
import { notificationsController } from "../modules/notifications/notifications.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", (req, res) => notificationsController.get(req, res));

export default router;
