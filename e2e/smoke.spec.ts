import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Smoke Tests', () => {
  test('homepage loads and is reachable', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(500);

    // Ensure screenshots dir exists
    const screenshotsDir = path.join(__dirname, '../screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    await page.screenshot({
      path: path.join(screenshotsDir, 'homepage.png'),
      fullPage: true,
    });
  });

  test('page has a title', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    console.log(`Page title: "${title}"`);
  });
});
