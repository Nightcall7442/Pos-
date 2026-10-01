import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Куда проксировать API. По умолчанию — локальный бэкенд разработки; сквозные
// тесты (e2e/) поднимают свой бэкенд на другом порту и передают его сюда.
const apiTarget = process.env.VITE_PROXY_TARGET ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5174,
    allowedHosts: "all",
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/socket.io": {
        target: apiTarget,
        ws: true,
      },
    },
  },
});
