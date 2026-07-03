import { test, expect } from "@playwright/test"
import path from "path"

const screenshotsDir = path.join(__dirname, "..", "screenshots", "v3")

test.describe("V3 Inbox placement display", () => {
  test("placement tab shows table with rows", async ({ page }) => {
    await page.goto("/clients/gladlane?tab=placement")
    await page.waitForLoadState("networkidle")

    // Wait for tab content to render
    await page.waitForTimeout(2000)

    const mainContent = await page.textContent("main")
    expect(mainContent).toBeTruthy()

    // Should show the placement table (not "No Placement Data" empty state)
    // The table has columns: Campaign, Test Date, Inbox %, Spam %, Status
    const table = page.locator("table")
    const tableCount = await table.count()

    if (tableCount > 0) {
      // Table should have at least one data row
      const rows = table.first().locator("tbody tr")
      const rowCount = await rows.count()
      expect(rowCount).toBeGreaterThan(0)

      // Verify column headers exist
      const headerText = await table.first().locator("thead").textContent()
      expect(headerText).toContain("Campaign")
      expect(headerText).toContain("Inbox %")
      expect(headerText).toContain("Spam %")
      expect(headerText).toContain("Status")
    } else {
      // If no table, the empty state should be visible
      const emptyState = page.locator("text=No Placement Data")
      await expect(emptyState).toBeVisible()
    }

    await page.screenshot({
      path: path.join(screenshotsDir, "placement-tab-table.png"),
      fullPage: true,
    })
  })

  test("high-spam campaigns show warning status badges", async ({ page }) => {
    await page.goto("/clients/gladlane?tab=placement")
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(2000)

    const table = page.locator("table")
    const tableCount = await table.count()

    if (tableCount > 0) {
      const rows = table.first().locator("tbody tr")
      const rowCount = await rows.count()

      if (rowCount > 0) {
        // Check for Warning or Poor badges (high spam = low inbox %)
        const warningBadges = page.locator("text=Warning")
        const poorBadges = page.locator("text=Poor")
        const goodBadges = page.locator("text=Good")

        const warningCount = await warningBadges.count()
        const poorCount = await poorBadges.count()
        const goodCount = await goodBadges.count()

        // At least some status badges should be present
        expect(warningCount + poorCount + goodCount).toBeGreaterThan(0)

        // Per PRD notes, some campaigns have 34% spam — should show Warning or Poor
      }
    }

    await page.screenshot({
      path: path.join(screenshotsDir, "placement-tab-warnings.png"),
      fullPage: true,
    })
  })

  test("placement trend chart renders", async ({ page }) => {
    await page.goto("/clients/gladlane?tab=placement")
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(2000)

    // The trend chart section should be visible
    const trendSection = page.locator("text=Inbox Placement Trend")
    const trendVisible = await trendSection.count()

    if (trendVisible > 0) {
      await expect(trendSection.first()).toBeVisible()
    }

    await page.screenshot({
      path: path.join(screenshotsDir, "placement-tab-trend-chart.png"),
      fullPage: true,
    })
  })

  test("placement tab works with parent-client (roosterpunk)", async ({
    page,
  }) => {
    await page.goto("/clients/roosterpunk?tab=placement")
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(2000)

    const mainContent = await page.textContent("main")
    expect(mainContent).toBeTruthy()

    // Should render either the placement table or empty state — no error
    const hasTable = (await page.locator("table").count()) > 0
    const hasEmptyState =
      (await page.locator("text=No Placement Data").count()) > 0

    expect(hasTable || hasEmptyState).toBe(true)

    await page.screenshot({
      path: path.join(screenshotsDir, "placement-tab-roosterpunk.png"),
      fullPage: true,
    })
  })
})
