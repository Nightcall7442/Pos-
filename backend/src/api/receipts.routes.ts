import { Router } from "express";
import { receiptService } from "../modules/receipts/receipt.service.js";
import { authenticate } from "../middleware/auth.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { handleError } from "../utils/errors.js";

const router = Router();

router.use(authenticate);

router.get("/:orderId", async (req, res) => {
  try {
    const html = await receiptService.generateReceiptHTML(
      req.user!.tenantId,
      req.params.orderId as string
    );
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    handleError(res, error, 404);
  }
});

router.post("/:orderId/print", async (req, res) => {
  try {
    await receiptService.markAsPrinted(
      req.user!.tenantId,
      req.params.orderId as string
    );
    sendSuccess(res, { printed: true });
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
