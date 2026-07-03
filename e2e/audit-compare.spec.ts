import { test, expect } from "@playwright/test"

/** Audit log (ACT-2) + client comparison. Read-only. */

test("audit log renders filters, count and table", async ({ page }) => {
  await page.goto("/audit")
  await expect(page.getByRole("heading", { name: "Audit Log" })).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByText("Live action log").first()).toBeVisible()
  await expect(page.getByText(/actions? found/).first()).toBeVisible()
})

test("compare requires 2+ clients, then renders charts", async ({ page }) => {
  await page.goto("/compare")
  await expect(
    page.getByRole("heading", { name: "Client Comparison" })
  ).toBeVisible({ timeout: 60_000 })
  await expect(
    page.getByText("Select at least 2 clients to compare")
  ).toBeVisible()

  await page.goto("/compare?clients=cylindo,paycaptain")
  await expect(page.getByText("Data as of").first()).toBeVisible({
    timeout: 60_000,
  })
  // Recharts surfaces render for the selected pair
  await expect(page.locator("svg.recharts-surface").first()).toBeVisible()
})
