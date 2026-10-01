import { Server, type DefaultEventsMap } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { getEnv } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import type { TokenClaims } from "../../middleware/auth.js";

// Что мы держим на соединении. Раньше эти три поля вешались на сокет через
// `(socket as any).tenantId = ...`; socket.data для этого и существует, и с
// ним опечатка в имени поля становится ошибкой компиляции.
interface SocketData {
  tenantId: string;
  userId: string;
  role: string;
}

let io: Server;

export function initSocketIO(httpServer: HttpServer): Server {
  const env = getEnv();

  io = new Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ["GET", "POST"],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication required"));

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as TokenClaims;
      // Тот же разбор, что и в HTTP-слое: refresh-токен здесь не принимается.
      // Рукопожатие сокета раньше пускало любой токен с верной подписью.
      if (decoded.typ !== "access") return next(new Error("Invalid token"));
      socket.data.tenantId = decoded.tenantId;
      socket.data.userId = decoded.id;
      socket.data.role = decoded.role;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const { tenantId, userId, role } = socket.data;

    socket.join(`tenant:${tenantId}`);

    if (role === "kitchen" || role === "admin" || role === "manager") {
      socket.join(`tenant:${tenantId}:kitchen`);
    }

    // Обработчиков join:table / leave:table здесь больше нет. В комнаты
    // `table:<id>` ничего и никогда не отправлялось, и ни панель, ни касса эти
    // события не вызывали, — зато любой авторизованный клиент мог подписаться
    // на комнату стола чужой точки: имя комнаты не содержало tenantId и id
    // ничем не проверялся. Если подписка на отдельный стол понадобится,
    // комнату надо называть `table:<tenantId>:<tableId>` и проверять, что стол
    // принадлежит точке из токена.

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
