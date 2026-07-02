import { test } from "@playwright/test"
import path from "path"

const screenshotsDir = path.join(__dirname, "screenshots", "mailbox-validation")

test.use({ baseURL: "http://localhost:3002" })

test("inventory table groups visible", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 2400 })
  await page.goto("/clients/gladlane?tab=mailboxes", { waitUntil: "networkidle" })
  await page.waitForTimeout(2000)

  // Scroll to inventory table
  await page.getByText("Needs Attention").first().scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)

  await page.screenshot({
    path: path.join(screenshotsDir, "gladlane-inventory-groups.png"),
    fullPage: false,
  })

  // Also full page shot
  await page.screenshot({
    path: path.join(screenshotsDir, "gladlane-tall-full.png"),
    fullPage: true,
  })
})
