import { chromium } from 'playwright';

const BASE = 'http://localhost:3002';
const DOMAIN = process.argv[2] || 'valdaenergytariffs.com';
const SCREENSHOTS = '/tmp/valda-e2e';

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`E2E TEST: Retire ${DOMAIN}`);
  console.log(`${'='.repeat(60)}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1200 } });

  // Step 1: Navigate and capture pre-state
  console.log('Step 1: Navigating to Valda mailboxes tab...');
  await page.goto(`${BASE}/clients/valda?tab=mailboxes`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${SCREENSHOTS}/${DOMAIN}-01-pre-state.png`, fullPage: true });
  console.log('  Screenshot: pre-state saved');

  // Step 2: Scroll to Action Required and find the domain
  console.log('Step 2: Finding Retire button for ' + DOMAIN + '...');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);

  // Look for the retire button for this specific domain
  const retireBtn = page.locator(`button:has-text("Retire Domain")`);
  const retireBtnCount = await retireBtn.count();
  console.log(`  Found ${retireBtnCount} Retire Domain buttons`);

  // Find the one associated with our domain
  let targetBtn = null;
  const domainTexts = page.locator(`text=${DOMAIN}`);
  const domainCount = await domainTexts.count();
  console.log(`  Found ${domainCount} references to ${DOMAIN}`);

  if (domainCount > 0) {
    // Scroll the domain into view
    await domainTexts.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOTS}/${DOMAIN}-02-action-required.png` });

    // Find the closest Retire button to this domain text
    // The domain name and retire button should be in the same row/group
    const domainGroup = page.locator(`[data-domain="${DOMAIN}"], :has(> :text("${DOMAIN}")) button:has-text("Retire")`);
    if (await domainGroup.count() > 0) {
      targetBtn = domainGroup.first();
    } else {
      // Fallback: just click the first retire button
      targetBtn = retireBtn.first();
    }
  } else {
    console.log('  WARNING: Domain not found in page. May already be retired.');
    await browser.close();
    return;
  }

  // Step 3: Click Retire
  console.log('Step 3: Clicking Retire Domain...');
  if (retireBtnCount > 0) {
    await retireBtn.first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOTS}/${DOMAIN}-03-dialog.png` });

    // Confirm dialog
    const dialog = page.getByRole('dialog');
    const dialogVisible = await dialog.isVisible().catch(() => false);
    console.log(`  Confirm dialog visible: ${dialogVisible}`);

    if (dialogVisible) {
      const confirmBtn = dialog.locator('button:has-text("Retire Domain")');
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
        console.log('  Confirmed retire');
      }
    }
  }

  // Step 4: Wait for "Retiring..." state
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOTS}/${DOMAIN}-04-retiring.png` });
  const retiringText = page.locator('text=Retiring...');
  const hasRetiring = await retiringText.count();
  console.log(`  "Retiring..." visible: ${hasRetiring > 0}`);

  // Step 5: Wait for completion (up to 60s)
  console.log('Step 5: Waiting for completion...');
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(3000);
    const stillRetiring = await page.locator('text=Retiring...').count();
    if (stillRetiring === 0) {
      console.log(`  Completed after ~${(i + 1) * 3}s`);
      break;
    }
    if (i === 19) console.log('  WARNING: Timed out after 60s');
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOTS}/${DOMAIN}-05-post-retire.png`, fullPage: true });
  console.log('  Screenshot: post-retire saved');

  // Step 6: Check toast
  const toasts = page.locator('[data-sonner-toast]');
  const toastCount = await toasts.count();
  if (toastCount > 0) {
    for (let i = 0; i < toastCount; i++) {
      const text = await toasts.nth(i).textContent();
      console.log(`  Toast: ${text}`);
    }
  }

  await browser.close();
  console.log(`\nPlaywright test complete for ${DOMAIN}`);
  console.log(`Screenshots saved to ${SCREENSHOTS}/${DOMAIN}-*.png`);
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
