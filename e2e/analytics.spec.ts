import { test, expect } from "@playwright/test"

/**
 * The standalone analytics/health/domains/accounts pages are intentional
 * redirects into the client-tab IA (DEF-4 decision). Assert the redirects
 * hold so a regression doesn't resurrect half-dead pages.
 */

test("analytics redirects home", async ({ page }) => {
  await page.goto("/analytics")
  await page.waitForURL(/\/$/, { timeout: 30_000 })
})

test("client analytics redirects to the client campaigns tab", async ({
  page,
}) => {
  await page.goto("/analytics/cylindo")
  await page.waitForURL(/\/clients\/cylindo\?tab=campaigns/, {
    timeout: 30_000,
  })
})

test("health with client param redirects to the client mailboxes tab", async ({
  page,
}) => {
  await page.goto("/health?client=cylindo")
  await page.waitForURL(/\/clients\/cylindo\?tab=mailboxes/, {
    timeout: 30_000,
  })
})

test("domains and accounts redirect home", async ({ page }) => {
  await page.goto("/domains")
  await page.waitForURL(/\/$/, { timeout: 30_000 })
  await page.goto("/accounts")
  await page.waitForURL(/\/$/, { timeout: 30_000 })
})
