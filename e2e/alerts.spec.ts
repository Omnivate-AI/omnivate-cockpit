import { test, expect } from "@playwright/test"

/**
 * Global alerts page (ALERT-1/2). Read-only — asserts structure and the
 * live-view labeling; alert contents drift with real operations.
 */

test("alerts page renders summary, filters and table", async ({ page }) => {
  await page.goto("/alerts")
  await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByText("Live alerts").first()).toBeVisible()
  // Severity summary cards (both vocabularies bucketized)
  await expect(page.getByText("Critical", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Warning", { exact: true }).first()).toBeVisible()
  // Table renders rows or the explicit empty message — never blank
  await expect(
    page.locator("table tbody tr").first().or(page.getByText(/no .*alerts/i).first())
  ).toBeVisible()
})

test("tier filter present, actionable is the default view (07-06 rebuild)", async ({
  page,
}) => {
  await page.goto("/alerts")
  await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible({
    timeout: 60_000,
  })
  // The tier select renders with Actionable as the default value; the
  // maintenance pile is opt-in only. Structure-only — alert contents drift.
  await expect(
    page.getByText("Actionable", { exact: true }).first()
  ).toBeVisible()
})

test("alert rows expand into a full-context detail (ALERT-3)", async ({
  page,
}) => {
  await page.goto("/alerts")
  await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible({
    timeout: 60_000,
  })
  const firstRow = page.locator("table tbody tr").first()
  const hasRows = await firstRow
    .locator("td")
    .count()
    .then((n) => n > 1)
    .catch(() => false)
  test.skip(!hasRows, "no alerts present to expand")

  await firstRow.click()
  // Detail panel fields
  await expect(page.getByText("Type", { exact: true }).first()).toBeVisible()
  await expect(
    page.getByText("Created", { exact: true }).first()
  ).toBeVisible()
})
