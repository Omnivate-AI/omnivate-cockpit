import { defineConfig } from "@playwright/test"
import path from "path"
import fs from "fs"

// Load .env.local for Supabase credentials in E2E tests
const envPath = path.resolve(__dirname, ".env.local")
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath)
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
})
