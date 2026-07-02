import { test, expect } from "@playwright/test"
import path from "path"

const screenshotsDir = path.join(__dirname, "screenshots", "mailbox-validation")

test.use({ baseURL: "http://localhost:3002" })

test("orbitalx mailbox tab shows retire buttons", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 2000 })
  await page.goto("/clients/orbitalx?tab=mailboxes", { waitUntil: "networkidle" })
  await page.waitForTimeout(3000)

  // Take screenshot first to see what's rendered
  await page.screenshot({
    path: path.join(screenshotsDir, "orbitalx-retire-buttons.png"),
    fullPage: true,
  })

  // Check for Retire Domain buttons
  const retireButtons = page.locator("button:has-text('Retire Domain')")
  const count = await retireButtons.count()

  // Also check for Action Required header
  const actionRequired = page.locator("text=Action Required")
  const arCount = await actionRequired.count()

  console.log(`Retire buttons: ${count}, Action Required headers: ${arCount}`)
})
