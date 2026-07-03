import { test, expect } from "@playwright/test"
import path from "path"

const screenshotsDir = path.join(__dirname, "screenshots", "mailbox-validation")

test.use({ baseURL: "http://localhost:3002" })

test("orbitalx burnt domains show drain buttons", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 })
  await page.goto("/clients/orbitalx?tab=mailboxes", { waitUntil: "networkidle" })
  await page.waitForTimeout(2000)

  // Expand burnt domains list
  const burntHeader = page.getByText(/Burnt domains awaiting action/).first()
  await expect(burntHeader).toBeVisible()
  await burntHeader.click()
  await page.waitForTimeout(500)

  // Verify drain buttons visible
  const drainButtons = page.getByRole("button", { name: /Drain/i })
  const count = await drainButtons.count()
  expect(count).toBeGreaterThan(0)

  await page.screenshot({
    path: path.join(screenshotsDir, "orbitalx-drain-buttons.png"),
  })
})
