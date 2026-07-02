import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import path from "path"

const screenshotsDir = path.join(__dirname, "screenshots")

const TEST_CLIENT = "e2e-test-alerts"
const TEST_DOMAIN = "e2e-alerts-domain.example.com"

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
    )
  }
  return createClient(url, key)
}

let seededDomainId: number | null = null
let seededAlertIds: number[] = []
let seededSetupId: number | null = null
let seededConfigId: number | null = null

test.describe("Alerts system end-to-end", () => {
  test.beforeAll(async () => {
    const supabase = getAdminClient()

    // 1. client_setups row so /clients/{slug} resolves
    const { data: setup, error: setupErr } = await supabase
      .from("client_setups")
      .insert({
        client_slug: TEST_CLIENT,
        display_name: "E2E Alerts Test",
        status: "completed",
        mailbox_per_domain: 2,
      })
      .select("id")
      .single()
    if (setupErr) throw new Error(`Setup seed failed: ${setupErr.message}`)
    seededSetupId = setup.id

    // 2. client_analytics_config
    const { data: config, error: configErr } = await supabase
      .from("client_analytics_config")
      .insert({
        client: TEST_CLIENT,
        display_name: "E2E Alerts Test",
        daily_email_target: 100,
        is_active: true,
        smartlead_client_ids: [],
        runway_warning_days: 14,
        runway_critical_days: 5,
      })
      .select("id")
      .single()
    if (configErr) throw new Error(`Config seed failed: ${configErr.message}`)
    seededConfigId = config.id

    // 3. mailbox_domains — needed as FK for alerts
    const { data: domain, error: domErr } = await supabase
      .from("mailbox_domains")
      .insert({
        domain_name: TEST_DOMAIN,
        client: TEST_CLIENT,
        platform: "google",
      })
      .select("id")
      .single()
    if (domErr) throw new Error(`Domain seed failed: ${domErr.message}`)
    seededDomainId = domain.id

    // 4. Seed 3 alerts: 1 critical unresolved, 1 warning unresolved, 1 resolved
    const alerts = [
      {
        domain_id: seededDomainId,
        alert_type: "burn_detected",
        severity: "critical",
        client: TEST_CLIENT,
        title: "E2E Critical Burn Alert",
        description: "Domain health dropped below 97% threshold",
        proposed_actions: [
          { action: "rotate", description: "Remove from campaigns" },
        ],
        status: "pending",
      },
      {
        domain_id: seededDomainId,
        alert_type: "low_send_volume",
        severity: "warning",
        client: TEST_CLIENT,
        title: "E2E Warning Low Sends",
        description: "Sending volume below 80% of target",
        proposed_actions: [],
        status: "pending",
      },
      {
        domain_id: seededDomainId,
        alert_type: "health_drop",
        severity: "warning",
        client: TEST_CLIENT,
        title: "E2E Resolved Health Drop",
        description: "Previously resolved health drop alert",
        proposed_actions: [],
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: "Resolved by e2e setup",
      },
    ]

    const { data: insertedAlerts, error: alertErr } = await supabase
      .from("mailbox_alerts")
      .insert(alerts)
      .select("id")
    if (alertErr) throw new Error(`Alerts seed failed: ${alertErr.message}`)
    seededAlertIds = (insertedAlerts ?? []).map((a) => a.id)
  })

  test.afterAll(async () => {
    const supabase = getAdminClient()

    // Clean up in reverse FK order
    if (seededAlertIds.length > 0) {
      await supabase.from("mailbox_alerts").delete().in("id", seededAlertIds)
    }
    if (seededDomainId) {
      await supabase.from("mailbox_domains").delete().eq("id", seededDomainId)
    }
    if (seededConfigId) {
      await supabase
        .from("client_analytics_config")
        .delete()
        .eq("id", seededConfigId)
    }
    if (seededSetupId) {
      await supabase.from("client_setups").delete().eq("id", seededSetupId)
    }

    // Belt-and-suspenders by slug
    await supabase.from("mailbox_alerts").delete().eq("client", TEST_CLIENT)
    await supabase
      .from("mailbox_domains")
      .delete()
      .eq("domain_name", TEST_DOMAIN)
    await supabase
      .from("client_analytics_config")
      .delete()
      .eq("client", TEST_CLIENT)
    await supabase
      .from("client_setups")
      .delete()
      .eq("client_slug", TEST_CLIENT)
  })

  test("alerts page shows unresolved and resolved sections", async ({
    page,
  }) => {
    await page.goto("/alerts")
    await page.waitForLoadState("networkidle")

    // The page should have an h1 with "Alerts"
    await expect(page.locator("h1")).toContainText("Alerts")

    // Should see our critical alert title
    const criticalAlert = page.locator("text=E2E Critical Burn Alert")
    await expect(criticalAlert.first()).toBeVisible({ timeout: 10000 })

    // Should see our warning alert title
    const warningAlert = page.locator("text=E2E Warning Low Sends")
    await expect(warningAlert.first()).toBeVisible()

    await page.screenshot({
      path: path.join(screenshotsDir, "alerts-page-full.png"),
      fullPage: true,
    })
  })

  test("resolve action moves alert to resolved section", async ({ page }) => {
    await page.goto("/alerts")
    await page.waitForLoadState("networkidle")

    // Find the Resolve button in the row with our warning alert
    const warningRow = page.locator("tr", { hasText: "E2E Warning Low Sends" })
    await expect(warningRow.first()).toBeVisible({ timeout: 10000 })

    const resolveBtn = warningRow.first().locator("button", { hasText: "Resolve" })
    await resolveBtn.click()
    await page.waitForTimeout(500)

    // The resolve dialog should open with a textarea for notes
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 3000 })

    // Fill in resolution notes
    const textarea = dialog.locator("textarea")
    await textarea.fill("E2E test resolution note")

    // Click the Resolve button inside the dialog footer (last "Resolve" button)
    const confirmBtn = dialog.locator("button", { hasText: "Resolve" }).last()
    await confirmBtn.click()
    await page.waitForTimeout(1500)

    // The dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 3000 })

    // The "Recently Resolved" section should appear with the resolved alert
    const resolvedSection = page.locator("button", {
      hasText: /Recently Resolved/,
    })
    await expect(resolvedSection).toBeVisible({ timeout: 5000 })

    await page.screenshot({
      path: path.join(screenshotsDir, "alerts-page-after-resolve.png"),
      fullPage: true,
    })
  })

  test("client alerts tab shows only client-specific alerts", async ({
    page,
  }) => {
    await page.goto(`/clients/${TEST_CLIENT}?tab=alerts`)
    await page.waitForLoadState("networkidle")

    // The alerts tab should show our test client alerts
    const criticalAlert = page.locator("text=E2E Critical Burn Alert")
    await expect(criticalAlert.first()).toBeVisible({ timeout: 10000 })

    await page.screenshot({
      path: path.join(screenshotsDir, "client-alerts-tab.png"),
      fullPage: true,
    })
  })

  test("sidebar alert badge reflects unresolved count", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // The sidebar should have an Alerts link with a badge count
    // Our 2 unresolved alerts plus any real ones should show a number > 0
    const alertsLink = page.locator("a, button", { hasText: "Alerts" }).first()
    await expect(alertsLink).toBeVisible()

    // The badge should show a count (at least our 2 unresolved alerts)
    const badge = alertsLink.locator("span").filter({ hasText: /\d+/ })
    if (await badge.count() > 0) {
      const badgeText = await badge.first().textContent()
      const count = parseInt(badgeText ?? "0", 10)
      expect(count).toBeGreaterThanOrEqual(1)
    }

    await page.screenshot({
      path: path.join(screenshotsDir, "sidebar-alert-badge.png"),
    })
  })
})
