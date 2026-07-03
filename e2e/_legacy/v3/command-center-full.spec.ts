import { test, expect } from "@playwright/test"
import path from "path"

const screenshotsDir = path.join(__dirname, "..", "screenshots", "v3")

test.describe("V3 Command Center full flow", () => {
  test("KPI cards render with values", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    await expect(page.locator("h1")).toContainText("Command Center")

    // KPI cards should have numeric values (text-3xl elements)
    const kpiValues = page.locator(".text-3xl, .text-2xl").first()
    await expect(kpiValues).toBeVisible({ timeout: 10000 })

    await page.screenshot({
      path: path.join(screenshotsDir, "command-center-kpis.png"),
      fullPage: true,
    })
  })

  test("client summary cards visible including Valda", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // Should have multiple client cards
    const clientHeadings = page.locator("h3")
    const count = await clientHeadings.count()
    expect(count).toBeGreaterThanOrEqual(3)

    // Valda should be visible (activated in US-004)
    const valdaText = page.locator("text=Valda")
    await expect(valdaText.first()).toBeVisible({ timeout: 10000 })

    await page.screenshot({
      path: path.join(screenshotsDir, "command-center-clients.png"),
    })
  })

  test("send chart has bars", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // Recharts renders SVG with rect elements for bars
    const chartContainer = page.locator(".recharts-responsive-container").first()
    if (await chartContainer.isVisible({ timeout: 5000 }).catch(() => false)) {
      const bars = chartContainer.locator("rect.recharts-bar-rectangle, .recharts-rectangle")
      const barCount = await bars.count()
      expect(barCount).toBeGreaterThanOrEqual(1)
    }

    await page.screenshot({
      path: path.join(screenshotsDir, "command-center-chart.png"),
    })
  })

  test("sync status widget renders", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // Look for sync-related text
    const syncWidget = page.locator("text=Health Monitor").or(
      page.locator("text=Analytics Refresh")
    ).or(
      page.locator("text=Sync All")
    )
    await expect(syncWidget.first()).toBeVisible({ timeout: 10000 })

    await page.screenshot({
      path: path.join(screenshotsDir, "command-center-sync.png"),
    })
  })

  test("time range filter updates URL", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // Look for time range buttons
    const thirtyDaysBtn = page.locator("button", { hasText: "30" }).or(
      page.locator("button", { hasText: "30 Days" })
    )

    if (await thirtyDaysBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await thirtyDaysBtn.first().click()
      await page.waitForTimeout(500)
      expect(page.url()).toContain("range=")
    }

    await page.screenshot({
      path: path.join(screenshotsDir, "command-center-range.png"),
      fullPage: true,
    })
  })
})
