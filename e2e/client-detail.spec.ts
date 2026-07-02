import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import path from "path"

const screenshotsDir = path.join(__dirname, "screenshots")

// Unique test client slug to avoid collisions with other test suites
const TEST_CLIENT = "e2e-test-client-detail"
const TEST_DISPLAY_NAME = "E2E Detail Test Client"

// Campaign IDs — high numbers to avoid collision
const CAMPAIGN_IDS = [9999901, 9999902, 9999903]
const CAMPAIGN_NAMES = [
  "E2E Primary Campaign 1",
  "E2E Primary Campaign 2",
  "E2E Subsequence Campaign 1",
]
const CAMPAIGN_TYPES = ["primary", "primary", "subsequence"] as const

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

// Track seeded IDs for cleanup
let seededSetupId: number | null = null
let seededConfigId: number | null = null
let seededSnapshotId: number | null = null
let seededCampaignRegistryIds: number[] = []
let seededCampaignSnapshotIds: number[] = []

test.describe("Client detail page tabs and campaigns", () => {
  test.beforeAll(async () => {
    const supabase = getAdminClient()
    const today = new Date().toISOString().split("T")[0]

    // 1. Insert client_setups row (status=completed so page renders fully)
    const { data: setup, error: setupErr } = await supabase
      .from("client_setups")
      .insert({
        client_slug: TEST_CLIENT,
        display_name: TEST_DISPLAY_NAME,
        status: "completed",
        domain_count: 5,
        mailbox_per_domain: 2,
        total_mailboxes: 10,
      })
      .select("id")
      .single()

    if (setupErr) throw new Error(`Failed to seed setup: ${setupErr.message}`)
    seededSetupId = setup.id

    // 2. Insert client_analytics_config
    const { data: config, error: configErr } = await supabase
      .from("client_analytics_config")
      .insert({
        client: TEST_CLIENT,
        display_name: TEST_DISPLAY_NAME,
        daily_email_target: 200,
        is_active: true,
        smartlead_client_ids: [],
        runway_warning_days: 14,
        runway_critical_days: 5,
      })
      .select("id")
      .single()

    if (configErr) throw new Error(`Failed to seed config: ${configErr.message}`)
    seededConfigId = config.id

    // 3. Insert analytics_snapshots
    const { data: snapshot, error: snapErr } = await supabase
      .from("analytics_snapshots")
      .insert({
        client: TEST_CLIENT,
        display_name: TEST_DISPLAY_NAME,
        snapshot_date: today,
        emails_sent_count: 175,
        positive_replies_count: 8,
        all_time_emails_sent: 2000,
        all_time_interested: 50,
        estimated_max_capacity: 500,
        mailbox_count: 10,
        daily_email_target: 200,
        daily_capacity: 300,
        hitting_target: false,
        total_runway_days: 25,
        campaign_runway_days: 18,
        pipeline_runway_days: 30,
        ready_leads: 120,
        qualified_no_email: 8,
        total_leads_in_campaigns: 600,
        unsent_campaign_leads: 250,
        subsequence_unsent: 60,
        runway_warning_days: 14,
        runway_critical_days: 5,
        alert_types_sent: [],
        leads_not_started: 120,
        leads_in_progress: 250,
        leads_completed: 180,
        leads_blocked: 50,
      })
      .select("id")
      .single()

    if (snapErr) throw new Error(`Failed to seed snapshot: ${snapErr.message}`)
    seededSnapshotId = snapshot.id

    // 4. Insert campaign_registry rows
    const campaignRows = CAMPAIGN_IDS.map((id, i) => ({
      client: TEST_CLIENT,
      smartlead_campaign_id: id,
      campaign_name: CAMPAIGN_NAMES[i],
      campaign_type: CAMPAIGN_TYPES[i],
      is_active: true,
    }))

    const { data: campaigns, error: campErr } = await supabase
      .from("campaign_registry")
      .insert(campaignRows)
      .select("id")

    if (campErr)
      throw new Error(`Failed to seed campaigns: ${campErr.message}`)
    seededCampaignRegistryIds = (campaigns ?? []).map((c) => c.id)

    // 5. Insert campaign_analytics_snapshots for each campaign
    const campaignSnapRows = CAMPAIGN_IDS.map((id, i) => ({
      client: TEST_CLIENT,
      campaign_id: id,
      campaign_name: CAMPAIGN_NAMES[i],
      snapshot_date: today,
      total_leads: 200 + i * 50,
      emails_sent: 150 + i * 30,
      bounced: 3 + i,
      positive_replies: 5 + i * 2,
      reply_count: 8 + i * 3,
      unsent_leads: 50 + i * 10,
      mailbox_count: 4 + i,
      positive_reply_rate: 2.5 - i * 0.5,
      leads_not_started: 50 + i * 10,
      leads_in_progress: 80 + i * 15,
      leads_completed: 60 + i * 10,
      leads_blocked: 10 + i * 5,
      all_time_emails_sent: 1000 + i * 200,
      all_time_interested: 25 + i * 5,
    }))

    const { data: campSnaps, error: campSnapErr } = await supabase
      .from("campaign_analytics_snapshots")
      .insert(campaignSnapRows)
      .select("id")

    if (campSnapErr)
      throw new Error(
        `Failed to seed campaign snapshots: ${campSnapErr.message}`
      )
    seededCampaignSnapshotIds = (campSnaps ?? []).map((s) => s.id)
  })

  test.afterAll(async () => {
    const supabase = getAdminClient()

    // Clean up in reverse FK order
    if (seededCampaignSnapshotIds.length > 0) {
      await supabase
        .from("campaign_analytics_snapshots")
        .delete()
        .in("id", seededCampaignSnapshotIds)
    }
    if (seededCampaignRegistryIds.length > 0) {
      await supabase
        .from("campaign_registry")
        .delete()
        .in("id", seededCampaignRegistryIds)
    }
    if (seededSnapshotId) {
      await supabase
        .from("analytics_snapshots")
        .delete()
        .eq("id", seededSnapshotId)
    }
    if (seededConfigId) {
      await supabase
        .from("client_analytics_config")
        .delete()
        .eq("id", seededConfigId)
    }
    if (seededSetupId) {
      await supabase
        .from("client_setups")
        .delete()
        .eq("id", seededSetupId)
    }

    // Belt-and-suspenders cleanup by slug
    await supabase
      .from("campaign_analytics_snapshots")
      .delete()
      .in("campaign_id", CAMPAIGN_IDS)
    await supabase
      .from("campaign_registry")
      .delete()
      .eq("client", TEST_CLIENT)
    await supabase
      .from("analytics_snapshots")
      .delete()
      .eq("client", TEST_CLIENT)
    await supabase
      .from("client_analytics_config")
      .delete()
      .eq("client", TEST_CLIENT)
    await supabase
      .from("client_setups")
      .delete()
      .eq("client_slug", TEST_CLIENT)
  })

  test("client header renders with name and health badge", async ({
    page,
  }) => {
    await page.goto(`/clients/${TEST_CLIENT}`)
    await page.waitForLoadState("networkidle")

    // Verify h1 shows client name
    const heading = page.locator("h1")
    await expect(heading).toContainText(TEST_DISPLAY_NAME)

    // Verify health badge is visible (should be one of Healthy/Warning/Critical/No Data)
    const badge = page.locator("span").filter({
      hasText: /^(Healthy|Warning|Critical|No Data)$/,
    })
    await expect(badge.first()).toBeVisible()

    await page.screenshot({
      path: path.join(screenshotsDir, "client-detail-header.png"),
      fullPage: true,
    })
  })

  test("clicking through each tab updates URL param", async ({ page }) => {
    await page.goto(`/clients/${TEST_CLIENT}`)
    await page.waitForLoadState("networkidle")

    const tabs = [
      { label: "Campaigns", param: "campaigns" },
      { label: "Pipelines", param: "pipelines" },
      { label: "Mailboxes", param: "mailboxes" },
      { label: "Alerts", param: "alerts" },
      { label: "Settings", param: "settings" },
      { label: "Overview", param: null }, // overview clears the tab param
    ]

    for (const tab of tabs) {
      await page.locator(`[role="tab"]`, { hasText: tab.label }).click()
      await page.waitForTimeout(500) // wait for URL update

      const url = page.url()
      if (tab.param) {
        expect(url).toContain(`tab=${tab.param}`)
      } else {
        // Overview tab removes ?tab= param
        expect(url).not.toContain("tab=")
      }

      await page.screenshot({
        path: path.join(
          screenshotsDir,
          `client-detail-tab-${tab.param ?? "overview"}.png`
        ),
      })
    }
  })

  test("campaigns tab shows 3 seeded campaign rows", async ({ page }) => {
    await page.goto(`/clients/${TEST_CLIENT}?tab=campaigns`)
    await page.waitForLoadState("networkidle")

    // Wait for the campaigns table to render
    const table = page.locator("table")
    await expect(table).toBeVisible()

    // Verify all 3 campaign names appear in the table
    for (const name of CAMPAIGN_NAMES) {
      await expect(page.locator("td", { hasText: name }).first()).toBeVisible()
    }

    // Verify the table has 3 data rows (inside tbody)
    const rows = table.locator("tbody tr")
    const rowCount = await rows.count()
    expect(rowCount).toBeGreaterThanOrEqual(3)

    await page.screenshot({
      path: path.join(screenshotsDir, "client-detail-campaigns-table.png"),
      fullPage: true,
    })
  })

  test("clicking campaign row opens expansion panel", async ({ page }) => {
    await page.goto(`/clients/${TEST_CLIENT}?tab=campaigns`)
    await page.waitForLoadState("networkidle")

    // Count initial rows
    const initialRowCount = await page.locator("tbody tr").count()

    // Click the first campaign row
    const firstCampaignRow = page
      .locator("tbody tr", { hasText: CAMPAIGN_NAMES[0] })
      .first()
    await firstCampaignRow.click()
    await page.waitForTimeout(1000)

    // After clicking, the expansion panel adds a new row with colSpan
    const postClickRowCount = await page.locator("tbody tr").count()
    expect(postClickRowCount).toBeGreaterThan(initialRowCount)

    // Verify the expanded row contains a colSpan cell (detail panel)
    const expandedCell = page.locator("td[colspan]")
    await expect(expandedCell.first()).toBeVisible()

    await page.screenshot({
      path: path.join(screenshotsDir, "client-detail-campaign-expanded.png"),
      fullPage: true,
    })
  })

  test("mailboxes tab renders", async ({ page }) => {
    await page.goto(`/clients/${TEST_CLIENT}?tab=mailboxes`)
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(1000)

    // Verify the tab content panel is visible
    const tabContent = page.locator('[role="tabpanel"]')
    await expect(tabContent).toBeVisible()

    // Since we didn't seed mailbox_accounts, expect "No Mailboxes" empty state
    // Accept either empty state or inventory table (in case real data exists)
    const emptyState = page.locator("text=No Mailboxes")
    const inventoryTable = page.locator("table")
    const content = emptyState.or(inventoryTable)
    await expect(content.first()).toBeVisible({ timeout: 10_000 })

    await page.screenshot({
      path: path.join(screenshotsDir, "client-detail-mailboxes-tab.png"),
      fullPage: true,
    })
  })
})
