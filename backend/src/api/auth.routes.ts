import { Router } from "express";
import { authController } from "../modules/auth/auth.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { loginSchema, registerSchema, refreshTokenSchema, changePasswordSchema, staffQuerySchema, loginPinSchema } from "../modules/auth/auth.schema.js";
import { authLimiter, staffLimiter, pinLoginLimiter } from "../middleware/rateLimiter.js";
import { auditLog } from "../middleware/audit.js";

const router = Router();

router.post("/login", authLimiter, validate(loginSchema), (req, res) => authController.login(req, res));
router.post("/register", authLimiter, validate(registerSchema), (req, res) => authController.register(req, res));
// Terminal tap-to-login: /staff lists a shop's employees who have a PIN set,
// /login-pin checks the PIN for the tile that was tapped. No email/password
// involved, so cashiers never type either at the register.
router.get("/staff", staffLimiter, validate(staffQuerySchema, "query"), (req, res) => authController.staff(req, res));
router.post("/login-pin", pinLoginLimiter, validate(loginPinSchema), (req, res) => authController.loginPin(req, res));
router.post("/refresh", validate(refreshTokenSchema), (req, res) => authController.refreshToken(req, res));
router.post("/change-password", authenticate, validate(changePasswordSchema), auditLog("auth.change_password", "user"), (req, res) => authController.changePassword(req, res));
router.get("/me", authenticate, (req, res) => authController.me(req, res));

export default router;
