import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./smoke",
  outputDir: "./smoke-results",
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: process.env.E2E_BASE_URL,
    headless: true,
    trace: "retain-on-failure",
    launchOptions: process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {},
  },
});
