import { defineConfig, devices } from "@playwright/test";
import path from "path";

// Load .env.local so tests can read Supabase credentials.
process.loadEnvFile(path.resolve(__dirname, ".env.local"));

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1, // serial per-file to avoid auth collisions
  reporter: [
    ["list"],
    ["html", { outputFolder: "browser-qa-screenshots/report" }],
  ],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    cwd: __dirname,
  },
});