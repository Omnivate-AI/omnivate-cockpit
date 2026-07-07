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
    "Actionable Alerts", // tiered per the 07-06 alert rebuild
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
  // Refresh button removed 2026-07-07 (manual dispatch dropped) — the panel
  // is read-only; it must NOT render a Refresh control.
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true })
  ).toHaveCount(0)
})

test("client summary grid links to client pages", async ({ page }) => {
  await expect(page.locator('a[href^="/clients/"]').first()).toBeVisible()
})

test("lead runway slider renders on client cards (Omar 07-06)", async ({
  page,
}) => {
  // Stacked completed/in-progress/not-started bar summed over ACTIVE
  // PRIMARY campaigns, with the legend counts.
  await expect(page.getByText(/Lead Runway/).first()).toBeVisible()
  await expect(page.getByText(/not started/).first()).toBeVisible()
  await expect(page.getByText(/in progress/).first()).toBeVisible()
  // Formula transparency on the In Campaigns gauge
  await expect(page.getByText(/emails ÷/).first()).toBeVisible()
})

test("send-targets chart is removed (Omar 07-06)", async ({ page }) => {
  await expect(page.getByText(/Daily Send Volume/)).toHaveCount(0)
})

test("portfolio infra roll-up renders (PORT-2/3)", async ({ page }) => {
  await expect(
    page.getByText("Infrastructure across clients").first()
  ).toBeVisible()
  await expect(page.getByText(/mailboxes in play/).first()).toBeVisible()
  await expect(page.getByText(/at-risk/).first()).toBeVisible()
  await expect(page.getByText(/blacklisted domains/).first()).toBeVisible()
  await expect(page.getByText(/open alerts/).first()).toBeVisible()
  // Per-client infra line on the cards
  await expect(page.getByText(/\d+ boxes/).first()).toBeVisible()
})

test("time range filter switches without breaking", async ({ page }) => {
  await page.getByRole("button", { name: "30 Days" }).click()
  await page.waitForURL(/range=30d/, { timeout: 30_000 })
  await expect(
    page.getByRole("heading", { name: "Command Center" })
  ).toBeVisible()
  await expect(page.getByText(/Emails Sent/).first()).toBeVisible()
})
