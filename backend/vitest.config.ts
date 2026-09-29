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
    },
  },
});
