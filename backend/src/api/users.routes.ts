import { Router } from "express";
import { userController } from "../modules/users/user.controller.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { auditLog } from "../middleware/audit.js";
import { createUserSchema, updateUserSchema, userQuerySchema } from "../modules/users/user.schema.js";

const router = Router();

router.use(authenticate);

router.get("/", validate(userQuerySchema, "query"), (req, res) => userController.findAll(req, res));
router.get("/:id", (req, res) => userController.findById(req, res));
router.post("/", authorize("admin", "manager"), validate(createUserSchema), auditLog("user.create", "user"), (req, res) => userController.create(req, res));
router.put("/:id", authorize("admin", "manager"), validate(updateUserSchema), auditLog("user.update", "user"), (req, res) => userController.update(req, res));
router.delete("/:id", authorize("admin"), auditLog("user.delete", "user"), (req, res) => userController.delete(req, res));
router.post("/:id/toggle", authorize("admin", "manager"), auditLog("user.toggle", "user"), (req, res) => userController.toggleActive(req, res));

export default router;
