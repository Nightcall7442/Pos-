import { defineConfig } from "vitest/config";

// Юнит-тесты панели: права доступа по ролям, деньги, разбор ошибок API.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
