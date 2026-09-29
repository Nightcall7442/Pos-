import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(window.location.origin, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      // Function form: re-read on every (re)connect so a refreshed access
      // token is used instead of the one from login time.
      auth: (cb) => cb({ token: localStorage.getItem("pos-token") }),
    });

    socket.on("connect_error", () => {
      // silently retry
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Kitchen notifications are broadcast by the server when the order is created
// (see order.service.ts); the terminal only needs a live connection so it is
// part of the tenant room.
export function ensureConnected(): void {
  getSocket();
}
