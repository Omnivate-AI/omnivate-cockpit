import { test, expect } from "@playwright/test"
import path from "path"

const screenshotsDir = path.join(__dirname, "screenshots", "mailbox-validation")

test.use({ baseURL: "http://localhost:3002" })

test("retire orbitalx domain end-to-end", async ({ page }) => {
  test.setTimeout(120_000) // 2 min — task may take time

  await page.setViewportSize({ width: 1500, height: 1200 })
  await page.goto("/clients/orbitalx?tab=mailboxes", { waitUntil: "networkidle" })
  await page.waitForTimeout(2000)

  // Screenshot before
  await page.screenshot({
    path: path.join(screenshotsDir, "orbitalx-before-retire.png"),
  })

  // Find Action Required section — should have retire buttons
  const actionRequired = page.getByText("Action Required").first()
  await expect(actionRequired).toBeVisible()

  // Click the first Retire Domain button (should be proorbitalx.com — worst health)
  const retireButtons = page.locator("button:has-text('Retire Domain')")
  const buttonCount = await retireButtons.count()
  expect(buttonCount).toBeGreaterThan(0)

  // Get the domain name from the first domain header
  await retireButtons.first().click()

  // Confirmation dialog should appear
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible({ timeout: 5000 })

  // Screenshot the dialog
  await page.screenshot({
    path: path.join(screenshotsDir, "orbitalx-retire-confirm-dialog.png"),
  })

  // Click confirm (the "Retire Domain" button inside the dialog)
  const confirmButton = dialog.locator("button:has-text('Retire Domain')")
  await confirmButton.click()

  // Wait for the task to complete — toast should appear
  await page.waitForTimeout(30000) // 30s for the task to run

  // Screenshot after
  await page.screenshot({
    path: path.join(screenshotsDir, "orbitalx-after-retire.png"),
  })

  // Refresh and take final screenshot
  await page.reload({ waitUntil: "networkidle" })
  await page.waitForTimeout(3000)
  await page.screenshot({
    path: path.join(screenshotsDir, "orbitalx-after-retire-refreshed.png"),
    fullPage: true,
  })
})
