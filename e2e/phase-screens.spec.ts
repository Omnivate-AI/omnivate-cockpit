import { test } from "@playwright/test"

/**
 * Screenshot capture for phase acceptance ("fresh screenshot set confirms
 * every removal landed" — V2 plan). NOT part of the regular suite: runs only
 * when SCREENSHOTS=1, writes PNGs to e2e/screenshots/.
 *
 *   SCREENSHOTS=1 npx playwright test phase-screens --project=chromium
 *   BASE_URL=https://omnivate-cockpit.vercel.app SCREENSHOTS=1 npx playwright test phase-screens --project=chromium
 */

const CLIENT = "cylindo"
const enabled = process.env.SCREENSHOTS === "1"

test.describe("phase screenshots", () => {
  test.skip(!enabled, "SCREENSHOTS=1 not set")

  test("capture key pages", async ({ page }) => {
    test.setTimeout(600_000)

    const shots: { path: string; url: string; waitFor?: string }[] = [
      { path: "command-center.png", url: "/", waitFor: "Positive Replies" },
      { path: "client-overview.png", url: `/clients/${CLIENT}`, waitFor: "Positive Replies" },
      { path: "client-campaigns.png", url: `/clients/${CLIENT}?tab=campaigns`, waitFor: "Campaign stats synced" },
      { path: "client-mailboxes.png", url: `/clients/${CLIENT}?tab=mailboxes`, waitFor: "Rotation Groups" },
    ]

    for (const s of shots) {
      await page.goto(s.url)
      if (s.waitFor) {
        await page.getByText(s.waitFor).first().waitFor({ timeout: 120_000 })
      }
      // Let charts/images settle
      await page.waitForTimeout(1500)
      await page.screenshot({
        path: `e2e/screenshots/${s.path}`,
        fullPage: true,
      })
    }
  })
})
