import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import path from "path"

const screenshotsDir = path.join(__dirname, "screenshots")

// Test client slugs — unique to avoid collisions with real data
const CLIENT_A = "e2e-test-client-a"
const CLIENT_B = "e2e-test-client-b"
const TEST_DOMAIN = "e2e-test-domain.example.com"

// Known seeded values
const EMAILS_SENT_A = 142
const EMAILS_SENT_B = 87
const TOTAL_EMAILS_SENT = EMAILS_SENT_A + EMAILS_SENT_B

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

// Seeded IDs for cleanup
let seededConfigIds: number[] = []
let seededSnapshotIds: number[] = []
let seededDomainId: number | null = null
let seededAlertId: number | null = null

test.describe("Command Center data flow", () => {
  test.beforeAll(async () => {
    const supabase = getAdminClient()
    const today = new Date().toISOString().split("T")[0]

    // 1. Insert client_analytics_config rows
    const { data: configs, error: configErr } = await supabase
      .from("client_analytics_config")
      .insert([
        {
          client: CLIENT_A,
          display_name: "E2E Test Client A",
          daily_email_target: 200,
          is_active: true,
          smartlead_client_ids: [],
          runway_warning_days: 14,
          runway_critical_days: 5,
        },
        {
          client: CLIENT_B,
          display_name: "E2E Test Client B",
          daily_email_target: 150,
          is_active: true,
          smartlead_client_ids: [],
          runway_warning_days: 14,
          runway_critical_days: 5,
        },
      ])
      .select("id")

    if (configErr) throw new Error(`Failed to seed configs: ${configErr.message}`)
    seededConfigIds = (configs ?? []).map((c) => c.id)

    // 2. Insert analytics_snapshots for both clients
    const { data: snapshots, error: snapErr } = await supabase
      .from("analytics_snapshots")
      .insert([
        {
          client: CLIENT_A,
          display_name: "E2E Test Client A",
          snapshot_date: today,
          emails_sent_count: EMAILS_SENT_A,
          positive_replies_count: 5,
          all_time_emails_sent: 1000,
          all_time_interested: 25,
          estimated_max_capacity: 500,
          mailbox_count: 10,
          daily_email_target: 200,
          daily_capacity: 300,
          hitting_target: false,
          total_runway_days: 30,
          campaign_runway_days: 20,
          pipeline_runway_days: 40,
          ready_leads: 100,
          qualified_no_email: 10,
          total_leads_in_campaigns: 500,
          unsent_campaign_leads: 200,
          subsequence_unsent: 50,
          runway_warning_days: 14,
          runway_critical_days: 5,
          alert_types_sent: [],
          leads_not_started: 100,
          leads_in_progress: 200,
          leads_completed: 150,
          leads_blocked: 50,
        },
        {
          client: CLIENT_B,
          display_name: "E2E Test Client B",
          snapshot_date: today,
          emails_sent_count: EMAILS_SENT_B,
          positive_replies_count: 3,
          all_time_emails_sent: 800,
          all_time_interested: 20,
          estimated_max_capacity: 400,
          mailbox_count: 8,
          daily_email_target: 150,
          daily_capacity: 240,
          hitting_target: false,
          total_runway_days: 25,
          campaign_runway_days: 15,
          pipeline_runway_days: 35,
          ready_leads: 80,
          qualified_no_email: 5,
          total_leads_in_campaigns: 400,
          unsent_campaign_leads: 150,
          subsequence_unsent: 30,
          runway_warning_days: 14,
          runway_critical_days: 5,
          alert_types_sent: [],
          leads_not_started: 80,
          leads_in_progress: 160,
          leads_completed: 120,
          leads_blocked: 40,
        },
      ])
      .select("id")

    if (snapErr) throw new Error(`Failed to seed snapshots: ${snapErr.message}`)
    seededSnapshotIds = (snapshots ?? []).map((s) => s.id)

    // 3. Insert a mailbox_domains row for the alert FK
    const { data: domain, error: domErr } = await supabase
      .from("mailbox_domains")
      .insert({
        domain_name: TEST_DOMAIN,
        client: CLIENT_A,
      })
      .select("id")
      .single()

    if (domErr) throw new Error(`Failed to seed domain: ${domErr.message}`)
    seededDomainId = domain.id

    // 4. Insert a critical alert linked to the domain
    const { data: alert, error: alertErr } = await supabase
      .from("mailbox_alerts")
      .insert({
        domain_id: seededDomainId,
        alert_type: "health_drop",
        severity: "critical",
        title: "E2E Critical Health Drop",
        description: "Test alert for E2E command center test",
        status: "pending",
      })
      .select("id")
      .single()

    if (alertErr) throw new Error(`Failed to seed alert: ${alertErr.message}`)
    seededAlertId = alert.id
  })

  test.afterAll(async () => {
    const supabase = getAdminClient()

    // Clean up in reverse order of FK dependencies
    if (seededAlertId) {
      await supabase.from("mailbox_alerts").delete().eq("id", seededAlertId)
    }
    if (seededDomainId) {
      await supabase.from("mailbox_domains").delete().eq("id", seededDomainId)
    }
    if (seededSnapshotIds.length > 0) {
      await supabase
        .from("analytics_snapshots")
        .delete()
        .in("id", seededSnapshotIds)
    }
    if (seededConfigIds.length > 0) {
      await supabase
        .from("client_analytics_config")
        .delete()
        .in("id", seededConfigIds)
    }

    // Belt-and-suspenders: clean up by client slug
    await supabase
      .from("mailbox_alerts")
      .delete()
      .in(
        "domain_id",
        (
          await supabase
            .from("mailbox_domains")
            .select("id")
            .eq("domain_name", TEST_DOMAIN)
        ).data?.map((d) => d.id) ?? []
      )
    await supabase
      .from("mailbox_domains")
      .delete()
      .eq("domain_name", TEST_DOMAIN)
    await supabase
      .from("analytics_snapshots")
      .delete()
      .in("client", [CLIENT_A, CLIENT_B])
    await supabase
      .from("client_analytics_config")
      .delete()
      .in("client", [CLIENT_A, CLIENT_B])
  })

  test("full page loads and screenshot captured", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // Verify page title
    await expect(page.locator("h1")).toContainText("Command Center")

    await page.screenshot({
      path: path.join(screenshotsDir, "command-center-full.png"),
      fullPage: true,
    })
  })

  test("KPI cards display aggregated values including seeded data", async ({
    page,
  }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // The "Emails Sent Yesterday" title lives in a <p> with text-sm
    const emailsSentTitle = page.locator("p", {
      hasText: "Emails Sent Yesterday",
    })
    await expect(emailsSentTitle.first()).toBeVisible()

    // The value is a sibling <p> with text-3xl inside the same parent div
    const valueEl = emailsSentTitle
      .first()
      .locator("..")
      .locator("p.text-3xl")
    const valueText = await valueEl.textContent()

    // The value should be a number string (possibly with commas) >= our seeded total
    const numericValue = parseInt((valueText ?? "0").replace(/,/g, ""), 10)
    expect(numericValue).toBeGreaterThanOrEqual(TOTAL_EMAILS_SENT)
  })

  test("2 client summary cards rendered for seeded clients", async ({
    page,
  }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // Look for our two test client display names in the client summary grid
    const clientA = page.locator("h3", { hasText: "E2E Test Client A" })
    const clientB = page.locator("h3", { hasText: "E2E Test Client B" })

    await expect(clientA).toBeVisible()
    await expect(clientB).toBeVisible()
  })

  test("alerts banner shows the seeded critical alert", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // The alerts banner should be visible with "Active Alerts" header
    const alertsBanner = page.locator("text=Active Alerts")
    await expect(alertsBanner).toBeVisible()

    // Our specific alert title should appear
    const alertTitle = page.locator("text=E2E Critical Health Drop")
    await expect(alertTitle).toBeVisible()

    // Severity badge should show "critical"
    const criticalBadge = page.locator("span", { hasText: "critical" }).first()
    await expect(criticalBadge).toBeVisible()
  })
})
