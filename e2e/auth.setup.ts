import { test as setup, expect } from "@playwright/test"
import path from "path"

/**
 * One-time login for the whole suite (storage state shared by every
 * project that depends on "setup"). Uses the smoke user — read-only
 * assertions everywhere, so the suite is safe against any environment,
 * including production.
 *
 * Credentials come from env: E2E_EMAIL / E2E_PASSWORD (playwright.config
 * loads .env.local). The smoke user is cockpit-smoke@omnivate.ai; reset
 * its password via the Supabase auth admin API if unknown.
 */

export const STORAGE_STATE = path.resolve(__dirname, ".auth", "user.json")

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD
  if (!email || !password) {
    throw new Error(
      "E2E_EMAIL / E2E_PASSWORD not set — add them to .env.local (smoke user)."
    )
  }

  await page.goto("/login")
  await page.locator("#email").fill(email)
  await page.locator("#password").fill(password)
  await page.getByRole("button", { name: /sign in/i }).click()

  // Successful login lands on the Command Center
  await page.waitForURL(/\/$/, { timeout: 45_000 })
  await expect(
    page.getByRole("heading", { name: "Command Center" })
  ).toBeVisible({ timeout: 45_000 })

  await page.context().storageState({ path: STORAGE_STATE })
})
