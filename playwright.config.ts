import { defineConfig } from "@playwright/test"
import path from "path"
import fs from "fs"

// Load .env.local for E2E credentials (E2E_EMAIL / E2E_PASSWORD)
const envPath = path.resolve(__dirname, ".env.local")
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath)
}

/**
 * DEF-8 rewrite (2026-07-03): the suites are READ-ONLY against the sp_*
 * read-models — they log in as the smoke user and assert structure,
 * labeling and contracts, never exact metric values and never seeding.
 * Safe to run against any environment, including production:
 *
 *   BASE_URL=https://omnivate-cockpit.vercel.app npx playwright test
 *
 * Default target is a locally running dev server (npm run dev first —
 * local SSR can be slow on this machine, hence the generous timeouts).
 * The pre-rewrite suites (which seeded LEGACY tables and drove removed
 * infra actions) are quarantined in e2e/_legacy/ and never run.
 */
export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["**/_legacy/**", "**/screenshots/**"],
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    navigationTimeout: 60_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        storageState: path.resolve(__dirname, "e2e", ".auth", "user.json"),
      },
      dependencies: ["setup"],
    },
  ],
})
