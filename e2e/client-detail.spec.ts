import { test, expect } from "@playwright/test"

/**
 * Client detail page + tabs (CAMP-1/2, INFRA-1/2, HEALTH-2/3).
 * Uses cylindo — the largest live client. Read-only.
 */

const CLIENT = "cylindo"

test("overview tab renders header and KPI grid", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT}`)
  await expect(page.getByText("Cylindo").first()).toBeVisible()
  // V3 Phase 3: the duplicate all-time KPI row was removed; the range-scoped
  // performance suite now owns positive replies. Assert the chart title
  // ("Positive Replies — {range}"), which is unique to that suite (not the tab).
  await expect(page.getByText(/Positive Replies —/).first()).toBeVisible({
    timeout: 60_000,
  })
  // V2 Phase 1 removals: live strip, mailbox summary KPI, pipeline runway
  await expect(page.getByText("Today, live")).toHaveCount(0)
  await expect(page.getByText("Mailbox Health", { exact: true })).toHaveCount(0)
  await expect(page.getByText("Pipeline Runway")).toHaveCount(0)
  // Recipient-inbox performance panel (from the send-split fill)
  await expect(page.getByText("By recipient inbox").first()).toBeVisible({
    timeout: 60_000,
  })
  // V4 A1/A3 — BOTH efficiency ratio cards at the client level
  await expect(
    page.getByText("Contacts per Positive Reply", { exact: true }).first()
  ).toBeVisible()
  await expect(
    page.getByText("Emails per Positive Reply", { exact: true }).first()
  ).toBeVisible()
  // V4 C2/C3/C4 — the provider suite follows the page's range selection
  await expect(page.getByText(/Reply Rate by Recipient Provider —/).first()).toBeVisible()
  await expect(page.getByText(/Reply Rate by Sender Mailbox Provider —/).first()).toBeVisible()
  await expect(page.getByText(/Provider Matrix \(sender × recipient\) —/).first()).toBeVisible()
  for (const tab of [
    "Overview",
    "Positive Replies",
    "Campaigns",
    "Pipelines",
    "Mailboxes",
    "Placement",
    "Alerts",
    "Settings",
  ]) {
    await expect(page.getByRole("tab", { name: tab })).toBeVisible()
  }
})

test("interested leads tab renders table or explicit empty state", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT}?tab=interested`)
  await expect(page.getByText("Cylindo").first()).toBeVisible({ timeout: 60_000 })
  // Either the interested-leads table (count chip) or the explicit empty
  // state — never a blank tab. Structure-only; rows drift with real replies.
  await expect(
    page
      .getByText(/positive (reply|replies)/i)
      .first()
      .or(page.getByText(/No Positive Replies Yet/i).first())
  ).toBeVisible()
})

test("mailboxes tab renders all lifecycle groups (resting-crash regression)", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT}?tab=mailboxes`)
  // Pre-fix behavior: resting/parked lifecycles had no group, the fallback
  // pushed into a nonexistent bucket, and the WHOLE tab was the error
  // boundary. This must never come back.
  await expect(page.getByText("Sending Capacity").first()).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByText("Something went wrong")).toHaveCount(0)
  await expect(page.getByText("Mailbox mirror synced").first()).toBeVisible()
  // Step-2 cards (INFRA-4 client scope + HEALTH-3)
  await expect(page.getByText("Blacklist Status").first()).toBeVisible()
  await expect(page.getByText("Orders & Spend").first()).toBeVisible()
  // HEALTH-4 history card — building state until 7 snapshots, then the chart
  await expect(
    page.getByText("Lifecycle & Health History").first()
  ).toBeVisible()
  await expect(
    page
      .getByText(/History building/)
      .or(page.locator("svg.recharts-surface"))
      .first()
  ).toBeVisible()
  // INFRA-3 domains table + INFRA-5 rotation line
  await expect(page.getByText(/Domains \(\d+\)/).first()).toBeVisible()
  await expect(page.getByText("Weekly rotation:").first()).toBeVisible()
  // Build-5 (R11): rotation-group capacity card + infra decisions panel
  await expect(page.getByText("Rotation Groups").first()).toBeVisible()
  await expect(page.getByText("Infrastructure Decisions").first()).toBeVisible()
  // V2 Phase 1: the legacy Add Capacity / Domain Pool flow is deleted —
  // Request Order (decisions panel) is the one ordering path.
  await expect(page.getByText("Domain Pool")).toHaveCount(0)
  await expect(page.getByText("Add Capacity")).toHaveCount(0)
})

test("infra decisions panel is actionable — approve/deny present when a decision is open (Build-5 R11)", async ({
  page,
}) => {
  // Read-only: asserts the panel + (for cylindo, which has open order
  // decisions) the Approve/Deny controls render. Never clicks them — those
  // flip live email-infra decisions.
  await page.goto(`/clients/${CLIENT}?tab=mailboxes`)
  await expect(page.getByText("Infrastructure Decisions").first()).toBeVisible({
    timeout: 60_000,
  })
  // The panel either shows the empty state or a needs-decision list; never
  // blank. .first() keeps the or-chain out of strict-mode when several
  // elements (heading + multiple Approve buttons) match at once.
  await expect(
    page
      .getByText("No open infrastructure decisions")
      .or(page.getByText(/Needs a decision/))
      .or(page.getByRole("button", { name: /Approve/ }))
      .first()
  ).toBeVisible()
})

test("campaigns tab shows lifetime stats with sync label", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT}?tab=campaigns`)
  await expect(page.getByText("Campaign stats synced").first()).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByText(/Emails Sent/).first()).toBeVisible()
  // V4 B1-B4 — cards lead with the positive-replies COUNT, then Sent and the
  // two ratios; the PRR% is off the card face (detail panel keeps it).
  await expect(page.getByText("Positive Replies", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Contacts / Pos", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Emails / Pos", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Positive Reply Rate", { exact: true })).toHaveCount(0)
})

test("pipelines tab: engine DAG section + collapsed-by-default cards (V4 D1/D2)", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT}?tab=pipelines`)
  await expect(page.getByText("Campaign Pipelines").first()).toBeVisible({
    timeout: 60_000,
  })
  // Cylindo has both worlds: an engine campaign + legacy definitions
  await expect(page.getByText("Legacy Pipelines").first()).toBeVisible()
  const engineCard = page.getByText("Cylindo Stage 2 Personalization").first()
  await expect(engineCard).toBeVisible()
  // Collapsed by default — the DAG body stays in the DOM (native <details>)
  // but must not be VISIBLE until the card is expanded. (Match the band label
  // "{n} steps — run in parallel", not the section subtitle prose.)
  const bandLabel = page.getByText(/\d+ steps — run in parallel/)
  await expect(bandLabel.first()).toBeHidden()
  // …and expands on click to reveal the true flow.
  await engineCard.click()
  await expect(bandLabel.first()).toBeVisible()
})

test("placement tab renders results or explicit empty state", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT}?tab=placement`)
  await expect(
    page
      .getByText("Latest placement test")
      .or(page.getByText("No Placement Data"))
      .first()
  ).toBeVisible({ timeout: 60_000 })
})

test("alerts tab renders live-view label or all-clear", async ({ page }) => {
  await page.goto(`/clients/${CLIENT}?tab=alerts`)
  await expect(
    page.getByText("Live alerts").or(page.getByText("All Clear")).first()
  ).toBeVisible({ timeout: 60_000 })
})

test("unknown client shows not-found instead of rendering junk", async ({
  page,
}) => {
  // With streamed SSR the status code is committed before notFound()
  // throws, so assert the rendered outcome rather than the status.
  await page.goto("/clients/not-a-real-client")
  await expect(
    page.getByText(/could not be found|404/i).first()
  ).toBeVisible({ timeout: 30_000 })
})
