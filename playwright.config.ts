import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env["PLAYWRIGHT_PORT"] ?? 8080);
const baseURL = process.env["PLAYWRIGHT_TEST_BASE_URL"] ?? `http://localhost:${PORT}`;
const reuse = !process.env["CI"];

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: Number(process.env["PLAYWRIGHT_WORKERS"] ?? 2),
  timeout: 90_000,
  expect: { timeout: 15_000 },

  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Permite apontar para um Chromium do sistema (sandbox/CI sem libs do Playwright).
        ...(process.env["PLAYWRIGHT_CHROMIUM_PATH"]
          ? { launchOptions: { executablePath: process.env["PLAYWRIGHT_CHROMIUM_PATH"] } }
          : {}),
      },
    },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],

  webServer: {
    command: "bun run dev",
    url: baseURL,
    reuseExistingServer: reuse,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
