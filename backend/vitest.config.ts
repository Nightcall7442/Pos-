import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL } from "./tests/testDatabase.js";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 20000,
    hookTimeout: 60000,
    fileParallelism: false,
    // Starts a dedicated API server on its own Postgres database (qwik_test,
    // see tests/testDatabase.ts) so the suite never touches the development one.
    globalSetup: ["./tests/globalSetup.ts"],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      TEST_BASE_URL: "http://127.0.0.1:3100",
      // Часть тестов импортирует код приложения напрямую (catalog.test.ts →
      // catalog.import.ts → logger.ts), а logger вызывает getEnv() на уровне
      // модуля. Без этих двух переменных схема env не проходила валидацию и
      // файл падал ещё до первого теста — на любой машине, где они не
      // выставлены в оболочке. Значения тестовые, те же, что у сервера в
      // globalSetup.
      JWT_SECRET: "test-jwt-secret-value-0123456789",
      JWT_REFRESH_SECRET: "test-refresh-secret-value-0123456789",
      LOG_LEVEL: "error",
    },
  },
});
