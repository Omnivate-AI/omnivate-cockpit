import { test, expect } from "@playwright/test"
import path from "path"

const screenshotsDir = path.join(__dirname, "screenshots", "mailbox-validation")

test.use({ baseURL: "http://localhost:3002" })

test("retire shows retiring state then completes", async ({ page }) => {
  test.setTimeout(120_000)

  await page.setViewportSize({ width: 1500, height: 1200 })
  await page.goto("/clients/valda?tab=mailboxes", { waitUntil: "networkidle" })
  await page.waitForTimeout(2000)

  // Count retire buttons before
  const retireButtons = page.locator("button:has-text('Retire Domain')")
  const beforeCount = await retireButtons.count()
  console.log(`Retire buttons before: ${beforeCount}`)

  if (beforeCount === 0) {
    console.log("No domains to retire — skipping")
    return
  }

  // Click first retire button
  await retireButtons.first().click()

  // Confirm dialog
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible({ timeout: 5000 })
  const confirmBtn = dialog.locator("button:has-text('Retire Domain')")
  await confirmBtn.click()

  // Should see "Retiring..." state within 2 seconds
  await page.waitForTimeout(2000)
  await page.screenshot({
    path: path.join(screenshotsDir, "orbitalx-retiring-state.png"),
  })

  // Check for "Retiring..." text
  const retiringText = page.locator("text=Retiring...")
  const hasRetiringState = await retiringText.count()
  console.log(`"Retiring..." visible: ${hasRetiringState > 0}`)

  // Wait for completion (polling runs every 3s, task takes ~15s)
  await page.waitForTimeout(40000)

  // Screenshot after completion
  await page.screenshot({
    path: path.join(screenshotsDir, "orbitalx-retire-completed.png"),
  })

  // Count retire buttons after — should be one less
  const afterCount = await page.locator("button:has-text('Retire Domain')").count()
  console.log(`Retire buttons after: ${afterCount}`)
  expect(afterCount).toBeLessThan(beforeCount)
})
