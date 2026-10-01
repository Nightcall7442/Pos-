import { defineConfig } from "vitest/config";

// Юнит-тесты кассы: корзина, деньги, вес, остатки на полке. jsdom — потому что
// корзина хранит себя в localStorage (zustand persist).
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
