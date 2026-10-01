import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

import { getEnv } from "./config/env.js";
import prisma from "./config/database.js";
import { initSocketIO } from "./modules/orders/order.gateway.js";
import { startStaleOrderSweeper } from "./modules/orders/order.cleanup.js";
import { setSocketIO } from "./modules/orders/order.service.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { logger } from "./utils/logger.js";

// Routes
import authRoutes from "./api/auth.routes.js";
import productRoutes from "./api/products.routes.js";
import orderRoutes from "./api/orders.routes.js";
import paymentRoutes from "./api/payments.routes.js";
import userRoutes from "./api/users.routes.js";
import categoryRoutes from "./api/categories.routes.js";
import inventoryRoutes from "./api/inventory.routes.js";
import reportRoutes from "./api/reports.routes.js";
import tableRoutes from "./api/tables.routes.js";
import settingsRoutes from "./api/settings.routes.js";
import notificationsRoutes from "./api/notifications.routes.js";
import receiptRoutes from "./api/receipts.routes.js";
import auditRoutes from "./api/audit.routes.js";
import stockReceiptRoutes from "./api/stock-receipts.routes.js";
import cashShiftRoutes from "./api/cash-shifts.routes.js";
import techCardRoutes from "./api/tech-cards.routes.js";
import catalogRoutes from "./api/catalog.routes.js";
import { importSnapshot } from "./modules/catalog/catalog.import.js";
import { catalogService } from "./modules/catalog/catalog.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const env = getEnv();
const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = initSocketIO(httpServer);
setSocketIO(io);

// Middleware
// Behind nginx (Docker) / the Vite dev proxy: take the client IP from
// X-Forwarded-For so rate limiting and audit see real addresses.
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(compression());
app.use(morgan("combined", {
  stream: { write: (message: string) => logger.info(message.trim()) },
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use("/uploads", express.static(path.join(__dirname, "..", env.UPLOAD_DIR)));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", apiLimiter, productRoutes);
app.use("/api/orders", apiLimiter, orderRoutes);
app.use("/api/payments", apiLimiter, paymentRoutes);
app.use("/api/users", apiLimiter, userRoutes);
app.use("/api/categories", apiLimiter, categoryRoutes);
app.use("/api/inventory", apiLimiter, inventoryRoutes);
app.use("/api/reports", apiLimiter, reportRoutes);
app.use("/api/tables", apiLimiter, tableRoutes);
app.use("/api/settings", apiLimiter, settingsRoutes);
app.use("/api/notifications", apiLimiter, notificationsRoutes);
app.use("/api/receipts", apiLimiter, receiptRoutes);
app.use("/api/audit", apiLimiter, auditRoutes);
app.use("/api/stock-receipts", apiLimiter, stockReceiptRoutes);
app.use("/api/cash-shifts", apiLimiter, cashShiftRoutes);
app.use("/api/tech-cards", apiLimiter, techCardRoutes);
app.use("/api/catalog", apiLimiter, catalogRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Start server
async function main() {
  try {
    await prisma.$connect();
    logger.info("Database connected");

    startStaleOrderSweeper(env.PENDING_ORDER_TTL_MINUTES);

    // Приватная сеть Railway (и её домены *.railway.internal) работает только
    // по IPv6, поэтому bind на 0.0.0.0 делал сервис недоступным для соседних
    // сервисов. "::" в Node открывает dual-stack сокет — IPv4 продолжает
    // работать, локально и в docker-compose ничего не меняется.
    httpServer.listen(env.PORT, "::", () => {
      logger.info(`Server running on port ${env.PORT}`);
      logger.info(`Environment: ${env.NODE_ENV}`);
    });

    // The barcode catalogue loads in the background: the API is up at once and
    // lookups simply find more as the import proceeds. Tests seed their own rows.
    if (env.NODE_ENV !== "test") {
      importSnapshot().catch((error) => logger.error("Barcode catalogue import failed", { message: error instanceof Error ? error.message : String(error) }));
      catalogService
        .probeSources()
        .then((reachable) => (reachable.openFoodFacts && reachable.nationalCatalogue ? logger.info : logger.warn)("Barcode sources reachable", reachable))
        .catch(() => undefined);
    }
  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
}

main();

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down...");
  await prisma.$disconnect();
  httpServer.close(() => process.exit(0));
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down...");
  await prisma.$disconnect();
  httpServer.close(() => process.exit(0));
});

export default app;
