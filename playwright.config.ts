import { config as loadDotenv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// Make sure NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc. are
// available to the Playwright runner (the setup project needs them to mint a
// magic link via the admin API).
loadDotenv({ path: ".env.local" });
loadDotenv();

const STORAGE_STATE = "tests/e2e/.auth/user.json";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      testMatch: /.*\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: STORAGE_STATE,
      },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // The dev shell has an empty ANTHROPIC_API_KEY exported by Claude Desktop
    // which would override .env.local; force a stub here so env.ts validates.
    env: {
      ANTHROPIC_API_KEY:
        process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 0
          ? process.env.ANTHROPIC_API_KEY
          : "stub-anthropic-key",
    },
  },
});
