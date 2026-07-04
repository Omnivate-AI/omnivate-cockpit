import { test, expect } from "@playwright/test"

/**
 * Client detail page + tabs (CAMP-1/2, INFRA-1/2, HEALTH-2/3).
 * Uses cylindo — the largest live client. Read-only.
 */

const CLIENT = "cylindo"

test("overview tab renders header, live strip and KPI grid", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT}`)
  await expect(page.getByText("Cylindo").first()).toBeVisible()
  await expect(page.getByText("Today, live").first()).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByText("Interested Replies").first()).toBeVisible()
  // Recipient-inbox performance panel (from the send-split fill)
  await expect(page.getByText("By recipient inbox").first()).toBeVisible()
  for (const tab of [
    "Overview",
    "Campaigns",
    "Pipelines",
    "Mailboxes",
    "Placement",
    "Alerts",
    "Settings",
  ]) {
    await expect(page.getByRole("tab", { name: tab })).toBeVisible()
  }
})

test("mailboxes tab renders all lifecycle groups (resting-crash regression)", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT}?tab=mailboxes`)
  // Pre-fix behavior: resting/parked lifecycles had no group, the fallback
  // pushed into a nonexistent bucket, and the WHOLE tab was the error
  // boundary. This must never come back.
  await expect(page.getByText("Sending Capacity").first()).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByText("Something went wrong")).toHaveCount(0)
  await expect(page.getByText("Mailbox mirror synced").first()).toBeVisible()
  // Step-2 cards (INFRA-4 client scope + HEALTH-3)
  await expect(page.getByText("Blacklist Status").first()).toBeVisible()
  await expect(page.getByText("Orders & Spend").first()).toBeVisible()
  // HEALTH-4 history card — building state until 7 snapshots, then the chart
  await expect(
    page.getByText("Lifecycle & Health History").first()
  ).toBeVisible()
  await expect(
    page
      .getByText(/History building/)
      .or(page.locator("svg.recharts-surface"))
      .first()
  ).toBeVisible()
  // INFRA-3 domains table + INFRA-5 rotation line
  await expect(page.getByText(/Domains \(\d+\)/).first()).toBeVisible()
  await expect(page.getByText("Weekly rotation:").first()).toBeVisible()
})

test("campaigns tab shows lifetime stats with sync label", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT}?tab=campaigns`)
  await expect(page.getByText("Campaign stats synced").first()).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByText(/Emails Sent/).first()).toBeVisible()
})

test("placement tab renders results or explicit empty state", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT}?tab=placement`)
  await expect(
    page
      .getByText("Latest placement test")
      .or(page.getByText("No Placement Data"))
      .first()
  ).toBeVisible({ timeout: 60_000 })
})

test("alerts tab renders live-view label or all-clear", async ({ page }) => {
  await page.goto(`/clients/${CLIENT}?tab=alerts`)
  await expect(
    page.getByText("Live alerts").or(page.getByText("All Clear")).first()
  ).toBeVisible({ timeout: 60_000 })
})

test("unknown client shows not-found instead of rendering junk", async ({
  page,
}) => {
  // With streamed SSR the status code is committed before notFound()
  // throws, so assert the rendered outcome rather than the status.
  await page.goto("/clients/not-a-real-client")
  await expect(
    page.getByText(/could not be found|404/i).first()
  ).toBeVisible({ timeout: 30_000 })
})
