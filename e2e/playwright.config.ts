import { defineConfig, devices } from "@playwright/test";

// Сквозные тесты кассы: настоящий бэкенд на настоящем Postgres (база
// qwik_e2e_test с демо-данными из prisma/seed.ts) и настоящая касса в браузере.
// Порты свои, чтобы не мешать запущенной разработке.
//
// Локально тесты ведут уже установленный Microsoft Edge — скачивать браузеры
// не нужно. В CI Playwright ставит свой Chromium (`npx playwright install`).
const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT || 3200);
const TERMINAL_PORT = Number(process.env.E2E_TERMINAL_PORT || 5274);

export default defineConfig({
  testDir: ".",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "../playwright-report" }]] : "list",
  outputDir: "../test-results",
  use: {
    baseURL: `http://localhost:${TERMINAL_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "terminal",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1366, height: 800 },
        ...(process.env.CI ? {} : { channel: "msedge" }),
      },
    },
  ],
  webServer: [
    {
      command: "node backend/node_modules/tsx/dist/cli.mjs e2e/start-backend.mts",
      cwd: "..",
      url: `http://127.0.0.1:${BACKEND_PORT}/health`,
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: "pipe",
      env: { E2E_BACKEND_PORT: String(BACKEND_PORT) },
    },
    {
      command: `npx vite --port ${TERMINAL_PORT} --strictPort`,
      cwd: "../pos-terminal",
      url: `http://localhost:${TERMINAL_PORT}`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: { VITE_PROXY_TARGET: `http://localhost:${BACKEND_PORT}` },
    },
  ],
});
