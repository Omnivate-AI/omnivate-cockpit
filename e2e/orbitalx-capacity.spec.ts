import { test } from "@playwright/test"
import path from "path"

const screenshotsDir = path.join(__dirname, "screenshots", "mailbox-validation")

test.use({ baseURL: "http://localhost:3002" })

test("orbitalx capacity cards show deployment plan", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 })
  await page.goto("/clients/orbitalx?tab=mailboxes", { waitUntil: "networkidle" })
  await page.waitForTimeout(1500)

  await page.screenshot({
    path: path.join(screenshotsDir, "orbitalx-capacity.png"),
  })
})
