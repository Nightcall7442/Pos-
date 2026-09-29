import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { getEnv } from "../../config/env.js";
import { logger } from "../../utils/logger.js";

let io: Server;

export function initSocketIO(httpServer: HttpServer): Server {
  const env = getEnv();

  io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ["GET", "POST"],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication required"));

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      (socket as any).tenantId = decoded.tenantId;
      (socket as any).userId = decoded.id;
      (socket as any).role = decoded.role;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const tenantId = (socket as any).tenantId;
    const userId = (socket as any).userId;
    const role = (socket as any).role;

    socket.join(`tenant:${tenantId}`);

    if (role === "kitchen" || role === "admin" || role === "manager") {
      socket.join(`tenant:${tenantId}:kitchen`);
    }

    socket.on("join:table", (tableId: string) => {
      socket.join(`table:${tableId}`);
    });

    socket.on("leave:table", (tableId: string) => {
      socket.leave(`table:${tableId}`);
    });

    socket.on("disconnect", () => {
      logger.info(`User ${userId} disconnected`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}

export { io };
