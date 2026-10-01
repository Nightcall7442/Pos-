import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "../store/authStore";

// Сокет хранится в состоянии, а не в ref. Раньше хук отдавал socketRef.current
// во время рендера: на первом рендере там ещё null, а подключение в эффекте не
// вызывало перерисовки — и экран (Кухня) подписывался на «новый заказ», только
// если его случайно перерисовало что-то другое. Звук и уведомление о новом
// заказе от этого могли не сработать.
export function useSocket() {
  const token = useAuthStore((s) => s.accessToken);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    const next = io("/", {
      auth: { token },
      transports: ["websocket"],
    });

    // Подписка на событие внешней системы: setState здесь — ответ на connect,
    // а не синхронная запись в эффекте.
    next.on("connect", () => setSocket(next));
    next.on("disconnect", () => setSocket((current) => (current === next ? null : current)));

    return () => {
      next.disconnect();
      setSocket((current) => (current === next ? null : current));
    };
  }, [token]);

  return token ? socket : null;
}
