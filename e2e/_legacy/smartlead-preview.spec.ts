import { test } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const SMARTLEAD_EMAIL = "omar@omnivate.ai";
const SMARTLEAD_PASSWORD = "Jebbar93*";
const CAMPAIGN_ID = "3068429";
const TEST_LEAD_EMAIL = "wcummings@arrowstream.com";

test.describe("Smartlead Email Preview", () => {
  test("preview Campaign A email with video embed", async ({ page }) => {
    test.setTimeout(120_000);

    const screenshotsDir = path.join(__dirname, "../screenshots");
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // Step 1: Login to Smartlead
    await page.goto("https://app.smartlead.ai/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    console.log("Login page URL:", page.url());

    // Fill email field using placeholder
    await page.locator('input[placeholder*="Email" i]').fill(SMARTLEAD_EMAIL);
    // Fill password field using placeholder
    await page.locator('input[placeholder*="Password" i]').fill(SMARTLEAD_PASSWORD);

    await page.screenshot({
      path: path.join(screenshotsDir, "smartlead-01-login-filled.png"),
    });

    // Click Login button
    await page.locator('button:has-text("Login")').click();

    // Wait for navigation after login
    await page.waitForTimeout(8000);
    await page.waitForLoadState("networkidle");

    // Take screenshot to see post-login state
    await page.screenshot({
      path: path.join(screenshotsDir, "smartlead-02-post-login.png"),
      fullPage: true,
    });
    console.log("Post-login URL:", page.url());

    // Step 2: Navigate to email campaigns list first to discover URL pattern
    await page.goto("https://app.smartlead.ai/app/email-campaign", {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: path.join(screenshotsDir, "smartlead-03-campaigns-list.png"),
      fullPage: true,
    });
    console.log("Campaigns list URL:", page.url());

    // Step 3: Navigate to the specific campaign
    await page.goto(
      `https://app.smartlead.ai/app/email-campaign/${CAMPAIGN_ID}`,
      { waitUntil: "networkidle" }
    );
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: path.join(screenshotsDir, "smartlead-04-campaign-page.png"),
      fullPage: true,
    });
    console.log("Campaign page URL:", page.url());

    // Step 4: Look for "Review & Launch" tab/button and click it
    const reviewBtn = page.locator(
      'text="Review & Launch", text="Review", a:has-text("Review"), button:has-text("Review")'
    ).first();
    if (await reviewBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reviewBtn.click();
      await page.waitForTimeout(3000);
      console.log("Clicked Review & Launch");
    } else {
      console.log("Review button not found, trying URL variant");
      // Try navigating to a review URL
      await page.goto(
        `https://app.smartlead.ai/app/email-campaign/${CAMPAIGN_ID}/leads`,
        { waitUntil: "networkidle" }
      );
      await page.waitForTimeout(3000);
    }

    await page.screenshot({
      path: path.join(screenshotsDir, "smartlead-05-review-page.png"),
      fullPage: true,
    });
    console.log("Review page URL:", page.url());

    // Step 5: Search for the test lead
    const searchInput = page.locator(
      'input[placeholder*="search" i], input[placeholder*="Search" i], input[type="search"]'
    ).first();
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill(TEST_LEAD_EMAIL);
      await page.waitForTimeout(2000);
      console.log("Searched for test lead");
    }

    // Click on the lead if visible
    const leadLink = page.locator(`text=${TEST_LEAD_EMAIL}`).first();
    if (await leadLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await leadLink.click();
      await page.waitForTimeout(3000);
      console.log("Clicked on test lead");
    }

    // Step 6: Final screenshot of email preview
    await page.screenshot({
      path: path.join(screenshotsDir, "smartlead-video-embed-preview.png"),
      fullPage: true,
    });

    console.log(
      "Screenshot saved to web/screenshots/smartlead-video-embed-preview.png"
    );
  });
});
