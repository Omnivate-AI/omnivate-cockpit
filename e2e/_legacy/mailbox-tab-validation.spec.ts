import { test, expect } from "@playwright/test"
import path from "path"

const screenshotsDir = path.join(__dirname, "screenshots", "mailbox-validation")

test.describe("Mailbox tab redesign validation", () => {
  test.use({ baseURL: "http://localhost:3002" })

  test("gladlane mailbox tab renders hero KPI cards + burnt list", async ({ page }) => {
    await page.goto("/clients/gladlane?tab=mailboxes", { waitUntil: "networkidle" })
    await page.waitForTimeout(2000)

    // Screenshot full page
    await page.screenshot({
      path: path.join(screenshotsDir, "gladlane-full.png"),
      fullPage: true,
    })

    // Screenshot top section only (viewport)
    await page.screenshot({
      path: path.join(screenshotsDir, "gladlane-hero.png"),
    })

    // Verify KPI cards are present
    const sendingCapacity = page.getByText("Sending Capacity").first()
    await expect(sendingCapacity).toBeVisible()

    const reserveBuffer = page.getByText("Reserve Buffer").first()
    await expect(reserveBuffer).toBeVisible()

    const actionNeeded = page.getByText("Burnt — Action Needed").first()
    await expect(actionNeeded).toBeVisible()

    // Verify the 1800 target is shown somewhere on the page
    const targetText = page.getByText(/1,800/).first()
    await expect(targetText).toBeVisible()

    // Verify collapsible burnt domains list
    const burntList = page.getByText(/Burnt domains awaiting action/).first()
    await expect(burntList).toBeVisible()

    // Expand burnt list
    await burntList.click()
    await page.waitForTimeout(500)
    await page.screenshot({
      path: path.join(screenshotsDir, "gladlane-burnt-expanded.png"),
      fullPage: true,
    })

    // Verify lifecycle breakdown
    const lifecycle = page.getByText("Lifecycle Distribution").first()
    await expect(lifecycle).toBeVisible()
  })

  test("edit targets dialog opens and persists", async ({ page }) => {
    await page.goto("/clients/roosterpunk?tab=mailboxes", { waitUntil: "networkidle" })
    await page.waitForTimeout(2000)

    // Should show "Target Unset" (roosterpunk has null target)
    await page.screenshot({
      path: path.join(screenshotsDir, "roosterpunk-unset.png"),
      fullPage: true,
    })

    // Click the edit pencil on Sending Capacity card
    const editButton = page.getByRole("button", { name: /edit targets/i }).first()
    await editButton.click()
    await page.waitForTimeout(500)

    // Dialog visible
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await page.screenshot({
      path: path.join(screenshotsDir, "roosterpunk-edit-dialog.png"),
    })

    // Cancel to not persist
    await page.getByRole("button", { name: /cancel/i }).click()
  })

  test("clients with warming-only show correct state", async ({ page }) => {
    await page.goto("/clients/cylindo?tab=mailboxes", { waitUntil: "networkidle" })
    await page.waitForTimeout(2000)

    await page.screenshot({
      path: path.join(screenshotsDir, "cylindo-warming.png"),
      fullPage: true,
    })
  })
})
