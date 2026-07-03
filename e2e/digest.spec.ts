import { test, expect } from "@playwright/test"

/**
 * Daily digest (NFR-8, SHELL-4). Read-only — asserts the always-present
 * structure including the explicit all-clear/issue sections.
 */

test("digest renders summary, per-client table and explicit sections", async ({
  page,
}) => {
  await page.goto("/digest")
  await expect(
    page.getByRole("heading", { name: "Daily Digest" })
  ).toBeVisible({ timeout: 60_000 })

  await expect(page.getByText(/Summary for /).first()).toBeVisible()
  await expect(page.getByText("Data as of").first()).toBeVisible()
  await expect(
    page.getByRole("button", { name: /copy/i }).first()
  ).toBeVisible()

  // Summary KPIs
  for (const kpi of [
    "Emails Sent",
    "Interested Replies",
    "Total Replies",
    "Overall Reply Rate",
  ]) {
    await expect(page.getByText(kpi, { exact: true }).first()).toBeVisible()
  }

  await expect(page.getByText("Per Client Breakdown")).toBeVisible()

  // Deliverability + alerts sections are EXPLICIT in both states —
  // an issues list or an all-clear card, never silently absent (SHELL-4)
  await expect(
    page
      .getByText("Deliverability Issues")
      .or(page.getByText("No deliverability issues"))
      .first()
  ).toBeVisible()
  await expect(
    page
      .getByText("Active Alerts")
      .or(page.getByText("No active alerts"))
      .first()
  ).toBeVisible()
})
