import { Router } from "express";
import { authController } from "../modules/auth/auth.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { loginSchema, registerSchema, refreshTokenSchema, changePasswordSchema } from "../modules/auth/auth.schema.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { auditLog } from "../middleware/audit.js";

const router = Router();

router.post("/login", authLimiter, validate(loginSchema), (req, res) => authController.login(req, res));
router.post("/register", authLimiter, validate(registerSchema), (req, res) => authController.register(req, res));
router.post("/refresh", validate(refreshTokenSchema), (req, res) => authController.refreshToken(req, res));
router.post("/change-password", authenticate, validate(changePasswordSchema), auditLog("auth.change_password", "user"), (req, res) => authController.changePassword(req, res));
router.get("/me", authenticate, (req, res) => authController.me(req, res));

export default router;
