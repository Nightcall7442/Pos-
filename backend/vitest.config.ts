import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 20000,
    hookTimeout: 60000,
    fileParallelism: false,
    // Starts a dedicated API server on its own SQLite file (prisma/test.db)
    // so the suite never touches the development database.
    globalSetup: ["./tests/globalSetup.ts"],
    env: {
      DATABASE_URL: "file:./test.db",
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
