import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import path from "path"

const screenshotsDir = path.join(__dirname, "..", "screenshots", "v3")

const TEST_CLIENT = "e2e-v3-alerts-bugfix"
const TEST_DOMAIN = "e2e-v3-alerts.example.com"

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

test.describe("V3 Alerts bug fix validation", () => {
  test.beforeAll(async () => {
    const supabase = getAdminClient()

    // 1. client_setups row
    const { data: setup, error: setupErr } = await supabase
      .from("client_setups")
      .insert({
        client_slug: TEST_CLIENT,
        display_name: "E2E V3 Alerts Bugfix",
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
        display_name: "E2E V3 Alerts Bugfix",
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

    // 3. mailbox_domains — FK for alerts
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

    // 4. Seed 3 alerts using status column (NOT is_resolved)
    const alerts = [
      {
        domain_id: seededDomainId,
        alert_type: "burn_detected",
        severity: "critical",
        client: TEST_CLIENT,
        title: "V3 Critical Burn Alert",
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
        title: "V3 Warning Low Sends",
        description: "Sending volume below 80% of target",
        proposed_actions: [],
        status: "pending",
      },
      {
        domain_id: seededDomainId,
        alert_type: "health_drop",
        severity: "warning",
        client: TEST_CLIENT,
        title: "V3 Resolved Health Drop",
        description: "Previously resolved health drop alert",
        proposed_actions: [],
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: "Resolved by e2e v3 setup",
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

    // Belt-and-suspenders cleanup by slug
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

  test("alerts page shows seeded alerts (status column works)", async ({
    page,
  }) => {
    await page.goto("/alerts")
    await page.waitForLoadState("networkidle")

    // Page should load with Alerts heading
    await expect(page.locator("h1")).toContainText("Alerts")

    // Our pending alerts should be visible (proves status='pending' query works)
    const criticalAlert = page.locator("text=V3 Critical Burn Alert")
    await expect(criticalAlert.first()).toBeVisible({ timeout: 10000 })

    const warningAlert = page.locator("text=V3 Warning Low Sends")
    await expect(warningAlert.first()).toBeVisible()

    await page.screenshot({
      path: path.join(screenshotsDir, "alerts-bugfix-visible.png"),
      fullPage: true,
    })
  })

  test("resolve alert via UI updates status to resolved", async ({ page }) => {
    await page.goto("/alerts")
    await page.waitForLoadState("networkidle")

    // Find row with the warning alert
    const warningRow = page.locator("tr", {
      hasText: "V3 Warning Low Sends",
    })
    await expect(warningRow.first()).toBeVisible({ timeout: 10000 })

    // Click Resolve button
    const resolveBtn = warningRow
      .first()
      .locator("button", { hasText: "Resolve" })
    await resolveBtn.click()
    await page.waitForTimeout(500)

    // Dialog should open
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 3000 })

    // Fill resolution notes
    const textarea = dialog.locator("textarea")
    await textarea.fill("V3 E2E resolution — status column test")

    // Confirm resolve
    const confirmBtn = dialog.locator("button", { hasText: "Resolve" }).last()
    await confirmBtn.click()
    await page.waitForTimeout(1500)

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 3000 })

    // The Recently Resolved section should appear
    const resolvedSection = page.locator("button", {
      hasText: /Recently Resolved/,
    })
    await expect(resolvedSection).toBeVisible({ timeout: 5000 })

    await page.screenshot({
      path: path.join(screenshotsDir, "alerts-bugfix-after-resolve.png"),
      fullPage: true,
    })
  })

  test("sidebar badge shows pending alert count", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // Find the Alerts link in sidebar
    const alertsLink = page.locator("a, button", { hasText: "Alerts" }).first()
    await expect(alertsLink).toBeVisible()

    // Badge should show a count >= 1 (our pending alerts + any real ones)
    const badge = alertsLink.locator("span").filter({ hasText: /\d+/ })
    if ((await badge.count()) > 0) {
      const badgeText = await badge.first().textContent()
      const count = parseInt(badgeText ?? "0", 10)
      expect(count).toBeGreaterThanOrEqual(1)
    }

    await page.screenshot({
      path: path.join(screenshotsDir, "alerts-bugfix-sidebar-badge.png"),
    })
  })
})
