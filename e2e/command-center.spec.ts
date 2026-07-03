import { test, expect } from "@playwright/test"

/**
 * Command Center (PERF-1, SHELL-4, DEF-5). Read-only — asserts structure
 * and labeling, never exact metric values (data drifts daily).
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "Command Center" })
  ).toBeVisible()
})

test("freshness labeling is present (SHELL-4)", async ({ page }) => {
  await expect(page.getByText("Data as of").first()).toBeVisible()
})

test("Today-live strip renders with webhook framing", async ({ page }) => {
  await expect(page.getByText("Today, live").first()).toBeVisible()
  await expect(page.getByText(/emails sent/).first()).toBeVisible()
})

test("KPI cards render", async ({ page }) => {
  for (const title of [
    "Interested Replies",
    "Total Replies",
    "Overall Reply Rate",
    "Active Alerts",
    "Sending Capacity",
  ]) {
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible()
  }
})

test("Data Freshness panel shows the real sync signals", async ({ page }) => {
  await expect(page.getByText("Data Freshness").first()).toBeVisible()
  for (const row of [
    "Daily sync",
    "Facts through",
    "Live send capture",
    "Live reply capture",
  ]) {
    await expect(page.getByText(row, { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    })
  }
  // PORT-1 refresh button exists
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }).first()
  ).toBeVisible()
})

test("client summary grid links to client pages", async ({ page }) => {
  await expect(page.locator('a[href^="/clients/"]').first()).toBeVisible()
})

test("time range filter switches without breaking", async ({ page }) => {
  await page.getByRole("button", { name: "30 Days" }).click()
  await page.waitForURL(/range=30d/, { timeout: 30_000 })
  await expect(
    page.getByRole("heading", { name: "Command Center" })
  ).toBeVisible()
  await expect(page.getByText(/Emails Sent/).first()).toBeVisible()
})
