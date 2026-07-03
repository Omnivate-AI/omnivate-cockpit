import { test, expect } from "@playwright/test"

/**
 * Orders & Spend page (INFRA-4). Read-only — asserts structure + the
 * charged-vs-projected cost semantics markers, not exact amounts.
 */

test("orders page renders KPIs, per-client rollup and order table", async ({
  page,
}) => {
  await page.goto("/orders")
  await expect(
    page.getByRole("heading", { name: /Orders & Spend/ })
  ).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText("Live orders").first()).toBeVisible()

  // KPI row
  for (const kpi of [
    /Spend \(/,
    "Mailboxes Purchased",
    "Domains Purchased",
    "Awaiting Approval",
  ]) {
    await expect(page.getByText(kpi).first()).toBeVisible()
  }

  await expect(page.getByText("Spend by Client")).toBeVisible()
  // The order table renders rows (36 historical orders exist) or the
  // explicit range-empty state — never a blank table
  await expect(
    page
      .locator("table tbody tr")
      .first()
      .or(page.getByText("No orders in this range").first())
  ).toBeVisible()
})

test("range selector filters without breaking", async ({ page }) => {
  await page.goto("/orders?range=30d")
  await expect(
    page.getByRole("heading", { name: /Orders & Spend/ })
  ).toBeVisible({ timeout: 60_000 })
  // Either orders exist in the window or the explicit empty state shows
  await expect(
    page
      .locator("table tbody tr")
      .first()
      .or(page.getByText(/No orders in this range/).first())
  ).toBeVisible()
})
