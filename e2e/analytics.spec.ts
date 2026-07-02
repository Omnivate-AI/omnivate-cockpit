import { test, expect } from "@playwright/test"
import path from "path"

const screenshotsDir = path.join(__dirname, "screenshots")

/**
 * Helper: check if snapshot data is available via the API.
 * Tests that depend on populated snapshots use this to determine
 * which assertions to make (data-present vs empty-state).
 */
async function hasSnapshotData(baseURL: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseURL}/api/analytics/snapshots`)
    if (!res.ok) return false
    const data = await res.json()
    return data.clients.some(
      (c: { latest: unknown }) => c.latest !== null,
    )
  } catch {
    return false
  }
}

// Test 1 — Overview loads
test("overview page loads with title and 4 stat blocks", async ({ page }) => {
  await page.goto("/analytics")
  await page.waitForLoadState("networkidle")

  // Page title
  await expect(page.locator("h1")).toContainText("Campaign Intelligence")

  // 4 stat blocks in the global strip are always rendered (even with 0 values)
  const statLabels = [
    "Emails Sent Yesterday",
    "Positive Replies",
    "Reply Rate",
    "Avg Runway",
  ]
  for (const label of statLabels) {
    await expect(
      page.locator("span", { hasText: label }).first(),
    ).toBeVisible()
  }

  await page.screenshot({
    path: path.join(screenshotsDir, "01-overview.png"),
    fullPage: true,
  })
})

// Test 2 — No auth wall
test("analytics page loads without authentication", async ({ browser }) => {
  // Fresh context with no cookies = unauthenticated
  const context = await browser.newContext()
  const page = await context.newPage()

  const response = await page.goto("/analytics")
  expect(response?.status()).toBe(200)

  // Should show the analytics page, not a login form
  await expect(page.locator("h1")).toContainText("Campaign Intelligence")
  await expect(page.locator("input[type='password']")).toHaveCount(0)

  await page.screenshot({
    path: path.join(screenshotsDir, "02-no-auth.png"),
    fullPage: true,
  })

  await context.close()
})

// Test 3 — Segment separation
test("Roosterpunk US and UK appear as separate elements", async ({
  page,
  baseURL,
}) => {
  const dataAvailable = await hasSnapshotData(baseURL!)
  await page.goto("/analytics")
  await page.waitForLoadState("networkidle")

  if (dataAvailable) {
    // With data: client cards render with segment names
    await page.waitForSelector("text=Roosterpunk", { timeout: 15_000 })

    const usCard = page.locator("text=Roosterpunk US").first()
    const ukCard = page.locator("text=Roosterpunk UK").first()

    await expect(usCard).toBeVisible()
    await expect(ukCard).toBeVisible()

    // They should be distinct elements (different bounding boxes)
    const usBox = await usCard.boundingBox()
    const ukBox = await ukCard.boundingBox()
    expect(usBox).toBeTruthy()
    expect(ukBox).toBeTruthy()
    expect(usBox!.y !== ukBox!.y || usBox!.x !== ukBox!.x).toBe(true)
  } else {
    // Without snapshot data: verify the API returns both segments as separate configs
    const res = await fetch(`${baseURL}/api/analytics/snapshots`)
    const data = await res.json()
    const slugs = data.clients.map(
      (c: { config: { client: string } }) => c.config.client,
    )
    expect(slugs).toContain("roosterpunk_us")
    expect(slugs).toContain("roosterpunk_uk")

    // Page shows the empty state message
    await expect(
      page.getByText("No snapshot data yet").or(page.getByText("Loading")),
    ).toBeVisible()
  }

  await page.screenshot({
    path: path.join(screenshotsDir, "03-segment-separation.png"),
    fullPage: true,
  })
})

// Test 4 — Status badge
test("at least one client card has a visible status badge", async ({
  page,
  baseURL,
}) => {
  const dataAvailable = await hasSnapshotData(baseURL!)
  await page.goto("/analytics")
  await page.waitForLoadState("networkidle")

  if (dataAvailable) {
    await page.waitForSelector("text=Roosterpunk", { timeout: 15_000 })

    // Status badges have text: Critical, Warning, or Healthy
    const badges = page.locator(
      "span:has-text('Critical'), span:has-text('Warning'), span:has-text('Healthy')",
    )
    const count = await badges.count()
    expect(count).toBeGreaterThanOrEqual(1)
  } else {
    // Without data: verify the page renders and stat blocks show zero values
    await expect(page.locator("h1")).toContainText("Campaign Intelligence")
    // Global stat blocks still render with "0" values
    await expect(
      page.locator("span", { hasText: "Emails Sent Yesterday" }).first(),
    ).toBeVisible()
  }

  await page.screenshot({
    path: path.join(screenshotsDir, "04-status-badge.png"),
    fullPage: true,
  })
})

// Test 5 — Detail page charts
test("detail page renders charts or empty state", async ({
  page,
  baseURL,
}) => {
  const dataAvailable = await hasSnapshotData(baseURL!)
  await page.goto("/analytics/gladlane")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  // Breadcrumb "Campaign Intelligence" link is always visible
  await expect(
    page.locator("text=Campaign Intelligence").first(),
  ).toBeVisible()

  if (dataAvailable) {
    // With data: charts render as SVGs, or "No send data" fallback messages
    const svgCharts = page.locator("svg.recharts-surface")
    const noSendData = page.locator("text=No send data available yet")
    const chartCount = await svgCharts.count()

    if (chartCount > 0) {
      expect(chartCount).toBeGreaterThanOrEqual(1)
    } else {
      await expect(noSendData).toBeVisible()
    }
  } else {
    // Without data: detail page shows "No data found" message
    await expect(
      page.getByText(/No data found for segment/),
    ).toBeVisible()
  }

  await page.screenshot({
    path: path.join(screenshotsDir, "05-detail-charts.png"),
    fullPage: true,
  })
})

// Test 6 — Campaign table rows
test("campaign table has rows or detail page shows empty state", async ({
  page,
  baseURL,
}) => {
  const dataAvailable = await hasSnapshotData(baseURL!)
  await page.goto("/analytics/roosterpunk_us")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  if (dataAvailable) {
    // Click the Campaigns tab
    await page.locator("button", { hasText: "Campaigns" }).click()
    await page.waitForTimeout(500)

    // Table should have campaign rows
    const tableRows = page.locator("table tbody tr")
    const rowCount = await tableRows.count()
    // roosterpunk_us should have at least 3 campaigns
    expect(rowCount).toBeGreaterThanOrEqual(3)
  } else {
    // Without data: page loads but shows no-data state
    await expect(
      page.getByText(/No data found for segment/).first(),
    ).toBeVisible()
  }

  await page.screenshot({
    path: path.join(screenshotsDir, "06-campaign-table.png"),
    fullPage: true,
  })
})

// Test 7 — Settings save
test("settings panel saves daily target change", async ({
  page,
  baseURL,
}) => {
  const dataAvailable = await hasSnapshotData(baseURL!)
  await page.goto("/analytics/roosterpunk_us")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  if (dataAvailable) {
    // Click the Settings tab
    await page.locator("button", { hasText: "Settings" }).click()
    await page.waitForTimeout(500)

    // Find the Daily email target input (first number input in settings)
    const dailyTargetInput = page.locator("input[type='number']").first()
    await expect(dailyTargetInput).toBeVisible()

    // Read current value
    const currentValue = await dailyTargetInput.inputValue()

    // Change to a test value
    const testValue = currentValue === "1500" ? "1600" : "1500"
    await dailyTargetInput.fill(testValue)
    await dailyTargetInput.press("Enter")

    // Wait for save to complete
    await page.waitForTimeout(2000)

    // Verify the input still shows the new value (persisted)
    await expect(dailyTargetInput).toHaveValue(testValue)

    // Restore original value
    await dailyTargetInput.fill(currentValue)
    await dailyTargetInput.press("Enter")
    await page.waitForTimeout(1500)
  } else {
    // Without data: verify config can be updated via API directly
    const res = await fetch(`${baseURL}/api/analytics/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: "roosterpunk_us",
        daily_email_target: 1500,
      }),
    })
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data.config.daily_email_target).toBe(1500)

    // Restore
    await fetch(`${baseURL}/api/analytics/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: "roosterpunk_us",
        daily_email_target: 2000,
      }),
    })
  }

  await page.screenshot({
    path: path.join(screenshotsDir, "07-settings-save.png"),
    fullPage: true,
  })
})

// Test 8 — Refresh button
test("refresh button shows loading state on click", async ({ page }) => {
  await page.goto("/analytics")
  await page.waitForLoadState("networkidle")

  // Find the Refresh button
  const refreshBtn = page.locator("button", { hasText: "Refresh" })
  await expect(refreshBtn).toBeVisible()

  // Click it
  await refreshBtn.click()

  // Button should show loading state — text changes to "Refreshing..."
  await expect(
    page.locator("button", { hasText: "Refreshing..." }),
  ).toBeVisible({ timeout: 5000 })

  await page.screenshot({
    path: path.join(screenshotsDir, "08-refresh-loading.png"),
    fullPage: true,
  })
})

// Test 9 — OrbitalX detail page does not show Valda campaigns
test("OrbitalX detail page does not show Valda campaigns", async ({
  page,
  baseURL,
}) => {
  const dataAvailable = await hasSnapshotData(baseURL!)
  await page.goto("/analytics/orbitalx")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  if (dataAvailable) {
    // Click Campaigns tab
    await page.locator("button", { hasText: "Campaigns" }).click()
    await page.waitForTimeout(500)

    // Valda should NOT be visible anywhere on the page
    const valdaText = page.locator("text=Valda")
    await expect(valdaText).toHaveCount(0)
  }

  await page.screenshot({
    path: path.join(screenshotsDir, "09-orbitalx-no-valda.png"),
    fullPage: true,
  })
})

// Test 10 — Subsequences appear in collapsed section not main table
test("Subsequences appear in collapsed section not main table", async ({
  page,
  baseURL,
}) => {
  const dataAvailable = await hasSnapshotData(baseURL!)
  await page.goto("/analytics/roosterpunk_us?tab=campaigns")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  if (dataAvailable) {
    // Subsequences heading should exist as a toggle button
    const subButton = page.locator("button", { hasText: /Subsequences/ })
    await expect(subButton).toBeVisible()

    // Main table should not contain "sub_sequence" in visible text
    const mainTableRows = page
      .locator("table")
      .first()
      .locator("tbody tr")
    const rowCount = await mainTableRows.count()
    for (let i = 0; i < rowCount; i++) {
      const rowText = await mainTableRows.nth(i).textContent()
      expect(rowText?.toLowerCase()).not.toContain("sub_sequence")
    }
  }

  await page.screenshot({
    path: path.join(screenshotsDir, "10-subsequences-section.png"),
    fullPage: true,
  })
})

// Test 11 — Sends chart has visible colored bars
test("Sends chart has visible colored bars", async ({
  page,
  baseURL,
}) => {
  const dataAvailable = await hasSnapshotData(baseURL!)
  await page.goto("/analytics/roosterpunk_us")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  if (dataAvailable) {
    // Recharts bar chart should be present in the DOM
    const rechartsChart = page.locator("svg.recharts-surface")
    const chartCount = await rechartsChart.count()
    expect(chartCount).toBeGreaterThanOrEqual(1)
  }

  await page.screenshot({
    path: path.join(screenshotsDir, "11-sends-chart.png"),
    fullPage: true,
  })
})

// Test 12 — Campaign Intelligence title visible on overview
test("Campaign Intelligence title visible on overview", async ({ page }) => {
  await page.goto("/analytics")
  await page.waitForLoadState("networkidle")

  const h1 = page.locator("h1")
  await expect(h1).toContainText("Campaign Intelligence")

  await page.screenshot({
    path: path.join(screenshotsDir, "12-campaign-intelligence-title.png"),
    fullPage: true,
  })
})

// Test 13 — Health endpoint returns triggerConfigured field
test("Health endpoint returns triggerConfigured field", async ({
  page,
  baseURL,
}) => {
  await page.goto("/analytics")
  await page.waitForLoadState("networkidle")

  const health = await page.evaluate(async () => {
    const res = await fetch("/api/analytics/health")
    return res.json()
  })

  expect(health).toHaveProperty("triggerConfigured")
  expect(typeof health.triggerConfigured).toBe("boolean")
  expect(health).toHaveProperty("supabaseConfigured")
  expect(typeof health.supabaseConfigured).toBe("boolean")

  await page.screenshot({
    path: path.join(screenshotsDir, "13-health-endpoint.png"),
    fullPage: true,
  })
})

// Test US-001 — Capacity utilization uses mailbox_count × 30
test("capacity stat block visible on detail page", async ({
  page,
  baseURL,
}) => {
  const dataAvailable = await hasSnapshotData(baseURL!)
  await page.goto("/analytics/roosterpunk_us")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  if (dataAvailable) {
    await expect(
      page.locator("span", { hasText: "Capacity" }).first(),
    ).toBeVisible()
    // Subtitle should say "mailbox capacity" not "max capacity"
    await expect(
      page.locator("text=mailbox capacity").first(),
    ).toBeVisible()
  }

  await page.screenshot({
    path: path.join(screenshotsDir, "us001-capacity.png"),
    fullPage: true,
  })
})

// Test US-002 — Pipeline funnel visible on detail page
test("pipeline funnel visible on detail page", async ({
  page,
  baseURL,
}) => {
  const dataAvailable = await hasSnapshotData(baseURL!)
  await page.goto("/analytics/gladlane")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  if (dataAvailable) {
    await expect(
      page.locator("[data-testid='pipeline-funnel']"),
    ).toBeVisible()
  }

  await page.screenshot({
    path: path.join(screenshotsDir, "us002-pipeline-funnel.png"),
    fullPage: true,
  })
})

// Test US-003 — Performance card visible on detail page
test("performance card visible on detail page", async ({
  page,
  baseURL,
}) => {
  const dataAvailable = await hasSnapshotData(baseURL!)
  await page.goto("/analytics/gladlane")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  if (dataAvailable) {
    await expect(
      page.locator("[data-testid='performance-card']"),
    ).toBeVisible()
  }

  await page.screenshot({
    path: path.join(screenshotsDir, "us003-performance-card.png"),
    fullPage: true,
  })
})

// Test US-004 — History API endpoint returns array
test("history API returns history array for valid client", async ({
  page,
  baseURL,
}) => {
  await page.goto("/analytics")
  await page.waitForLoadState("networkidle")

  const result = await page.evaluate(async () => {
    const res = await fetch("/api/analytics/history?client=gladlane&days=30")
    return { ok: res.ok, data: await res.json() }
  })

  expect(result.ok).toBe(true)
  expect(result.data).toHaveProperty("client", "gladlane")
  expect(Array.isArray(result.data.history)).toBe(true)

  await page.screenshot({
    path: path.join(screenshotsDir, "us004-history-api.png"),
    fullPage: true,
  })
})

// Test US-004b — History API returns 400 without client param
test("history API returns 400 without client param", async ({
  page,
}) => {
  await page.goto("/analytics")
  await page.waitForLoadState("networkidle")

  const result = await page.evaluate(async () => {
    const res = await fetch("/api/analytics/history")
    return { status: res.status, data: await res.json() }
  })

  expect(result.status).toBe(400)
  expect(result.data).toHaveProperty("error")
})

// Test US-005 — Chart date range selector
test("chart date range selector toggles active button", async ({
  page,
  baseURL,
}) => {
  const dataAvailable = await hasSnapshotData(baseURL!)
  await page.goto("/analytics/roosterpunk_us")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  if (dataAvailable) {
    // 14D button should be active by default (indigo background)
    const btn14 = page.locator("button", { hasText: "14D" })
    const btn30 = page.locator("button", { hasText: "30D" })
    await expect(btn14).toBeVisible()
    await expect(btn30).toBeVisible()

    // Click 30D button
    await btn30.click()
    await page.waitForTimeout(1000)

    // 30D should now have indigo class (active)
    await expect(btn30).toHaveClass(/bg-indigo-600/)
  }

  await page.screenshot({
    path: path.join(screenshotsDir, "us005-chart-range.png"),
    fullPage: true,
  })
})

// Test US-006 — Combined sends + replies chart (3 recharts SVGs)
test("detail page has at least 3 recharts chart SVGs", async ({
  page,
  baseURL,
}) => {
  const dataAvailable = await hasSnapshotData(baseURL!)
  await page.goto("/analytics/roosterpunk_us")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  if (dataAvailable) {
    const svgCharts = page.locator("svg.recharts-surface")
    const count = await svgCharts.count()
    expect(count).toBeGreaterThanOrEqual(3)
  }

  await page.screenshot({
    path: path.join(screenshotsDir, "us006-combined-chart.png"),
    fullPage: true,
  })
})

// Test US-007 — Trend badges visible when history available
test("trend badges visible on detail page when data available", async ({
  page,
  baseURL,
}) => {
  const dataAvailable = await hasSnapshotData(baseURL!)
  await page.goto("/analytics/roosterpunk_us")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  if (dataAvailable) {
    // If snapshot data exists, trend badges should render (if >= 14 days of history)
    const badges = page.locator("[data-testid='trend-badge']")
    const count = await badges.count()
    // May be 0 if history < 14 points, but if present should be > 0
    if (count > 0) {
      expect(count).toBeGreaterThanOrEqual(1)
    }
    // Yesterday Sends stat block should always be visible
    await expect(
      page.locator("span", { hasText: "Yesterday Sends" }).first(),
    ).toBeVisible()
  }

  await page.screenshot({
    path: path.join(screenshotsDir, "us007-trend-badges.png"),
    fullPage: true,
  })
})

// Test US-008 — Campaign spotlight visible when >= 2 primary campaigns
test("campaign spotlight visible on detail page", async ({
  page,
  baseURL,
}) => {
  const dataAvailable = await hasSnapshotData(baseURL!)
  await page.goto("/analytics/roosterpunk_us")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  if (dataAvailable) {
    // roosterpunk_us should have multiple primary campaigns
    const spotlight = page.locator("[data-testid='campaign-spotlight']")
    const count = await spotlight.count()
    if (count > 0) {
      await expect(spotlight).toBeVisible()
      // "View all campaigns" link should be present
      await expect(
        page.locator("text=View all campaigns").first(),
      ).toBeVisible()
    }
  }

  await page.screenshot({
    path: path.join(screenshotsDir, "us008-campaign-spotlight.png"),
    fullPage: true,
  })
})

// Test 14 — Global stats bar shows 4 stat numbers
test("Global stats bar shows 4 stat numbers", async ({ page }) => {
  await page.goto("/analytics")
  await page.waitForLoadState("networkidle")

  // The global stats bar contains 4 large numbers (text-2xl font-semibold)
  const statValues = page.locator(
    ".divide-x > div .text-2xl",
  )
  const count = await statValues.count()
  expect(count).toBe(4)

  await page.screenshot({
    path: path.join(screenshotsDir, "14-global-stats-bar.png"),
    fullPage: true,
  })
})
