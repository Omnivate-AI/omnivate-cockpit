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

test("freshness header line shows facts date + sync time (V2 Phase 1)", async ({
  page,
}) => {
  // One quiet line up top: "Data as of {business day} · synced {time}"
  await expect(page.getByText("Data as of").first()).toBeVisible()
  await expect(page.getByText(/synced/).first()).toBeVisible()
})

test("V2 Phase 1 removals stay removed", async ({ page }) => {
  // Green intraday strip
  await expect(page.getByText("Today, live")).toHaveCount(0)
  // Actionable Alerts + Sending Capacity KPI cards (alerts live on their
  // own page + sidebar badge)
  await expect(page.getByText("Actionable Alerts", { exact: true })).toHaveCount(0)
  await expect(page.getByText("Sending Capacity", { exact: true })).toHaveCount(0)
  // Bottom Data Freshness panel (replaced by the header line)
  await expect(page.getByText("Data Freshness")).toHaveCount(0)
})

test("KPI cards render", async ({ page }) => {
  for (const title of [
    "Positive Replies",
    "Total Replies",
  ]) {
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible()
  }
  // Reply-rate card is scoped + labeled to the selected range (answer #4);
  // default range on "/" is 7d.
  await expect(
    page.getByText("Reply Rate (Last 7 Days)", { exact: true }).first()
  ).toBeVisible()
})

test("client summary grid links to client pages", async ({ page }) => {
  await expect(page.locator('a[href^="/clients/"]').first()).toBeVisible()
})

test("sidebar carries the Omnivate mark + wordmark (V2 Phase 1)", async ({
  page,
}) => {
  await expect(page.getByAltText("Omnivate").first()).toBeVisible()
  await expect(page.getByText("Omnivate Cockpit")).toHaveCount(0)
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
