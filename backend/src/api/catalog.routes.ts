import { Router } from "express";
import { catalogController } from "../modules/catalog/catalog.controller.js";
import { catalogAddSchema, catalogLookupSchema } from "../modules/catalog/catalog.schema.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { auditLog } from "../middleware/audit.js";

const router = Router();

router.use(authenticate);

// Any signed-in user may ask what a barcode is; only admin and manager may put a product on the shelf.
router.get("/lookup", validate(catalogLookupSchema, "query"), (req, res) => catalogController.lookup(req, res));
router.get("/stats", (req, res) => catalogController.stats(req, res));
router.post("/add", authorize("admin", "manager"), validate(catalogAddSchema), auditLog("product.create", "product"), (req, res) => catalogController.add(req, res));

export default router;
