import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

// Хук раньше отдавал socketRef.current во время рендера: подключение в эффекте
// не вызывало перерисовки, и Кухня подписывалась на «новый заказ», только если
// её перерисовывало что-то ещё. Тест держит главное: подключился — компонент
// получил сокет без всякого постороннего повода.

type Handler = () => void;
const sockets: { handlers: Record<string, Handler>; disconnect: ReturnType<typeof vi.fn> }[] = [];

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => {
    const socket = {
      handlers: {} as Record<string, Handler>,
      on(event: string, handler: Handler) {
        this.handlers[event] = handler;
        return this;
      },
      disconnect: vi.fn(),
    };
    sockets.push(socket);
    return socket;
  }),
}));

const { useSocket } = await import("./socketService");
const { useAuthStore } = await import("../store/authStore");

describe("useSocket", () => {
  beforeEach(() => {
    sockets.length = 0;
    useAuthStore.setState({ accessToken: null, isAuthenticated: false });
  });

  it("hands the socket to the component as soon as it connects", () => {
    useAuthStore.setState({ accessToken: "token", isAuthenticated: true });
    const { result } = renderHook(() => useSocket());
    expect(result.current).toBeNull();

    act(() => sockets[0].handlers.connect());

    expect(result.current).toBe(sockets[0]);
  });

  it("drops the socket on disconnect and on logout", () => {
    useAuthStore.setState({ accessToken: "token", isAuthenticated: true });
    const { result } = renderHook(() => useSocket());
    act(() => sockets[0].handlers.connect());

    act(() => sockets[0].handlers.disconnect());
    expect(result.current).toBeNull();

    act(() => sockets[0].handlers.connect());
    act(() => useAuthStore.setState({ accessToken: null, isAuthenticated: false }));
    expect(result.current).toBeNull();
    expect(sockets[0].disconnect).toHaveBeenCalled();
  });

  it("does not connect without a token", () => {
    renderHook(() => useSocket());
    expect(sockets).toHaveLength(0);
  });
});
