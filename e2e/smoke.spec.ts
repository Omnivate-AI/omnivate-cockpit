import { test, expect } from "@playwright/test"

/**
 * Auth gate + shell smoke (AUTH-1 / SHELL-1..3). Read-only.
 * The gate tests run WITHOUT the shared storage state to prove the redirect.
 */

test.describe("auth gate", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("unauthenticated dashboard routes redirect to /login", async ({
    page,
  }) => {
    await page.goto("/")
    await page.waitForURL(/\/login/, { timeout: 30_000 })
    await expect(page.getByText("Deliverability Hub").first()).toBeVisible()
  })

  test("login page renders the form", async ({ page }) => {
    await page.goto("/login")
    await expect(page.locator("#email")).toBeVisible()
    await expect(page.locator("#password")).toBeVisible()
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible()
  })

  test("bad credentials show an error, not a blank screen", async ({
    page,
  }) => {
    await page.goto("/login")
    await page.locator("#email").fill("nobody@omnivate.ai")
    await page.locator("#password").fill("definitely-wrong")
    await page.getByRole("button", { name: /sign in/i }).click()
    await expect(
      page.getByText(/invalid|credentials|error/i).first()
    ).toBeVisible({ timeout: 20_000 })
  })
})

test.describe("authenticated shell", () => {
  test("sidebar navigation is complete", async ({ page }) => {
    await page.goto("/")
    const sidebar = page.locator("div.hidden.md\\:flex")
    // Assert by href — link text can include badges (e.g. "Alerts 60")
    for (const href of [
      "/",
      "/compare",
      "/digest",
      "/orders",
      "/alerts",
      "/audit",
      "/settings",
    ]) {
      await expect(sidebar.locator(`a[href="${href}"]`).first()).toBeVisible()
    }
    // Client switcher lists at least one active client
    await expect(sidebar.getByText("Cylindo").first()).toBeVisible()
  })
})
