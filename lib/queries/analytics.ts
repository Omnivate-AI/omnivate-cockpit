import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import { getActiveClients, resolveClientSlugs } from "@/lib/queries/clients"
import { getReadyBankBySlug, type ReadyBankRow } from "@/lib/queries/ready-bank"
import type { ClientConfig, ClientSnapshot, DailyTargets } from "@/types/analytics"
import { getTargetForDate } from "@/types/analytics"
import { toBusinessDay } from "@/lib/range-utils"

// Performance reads come from the sp_* read-models:
//   vw_cockpit_daily_client_perf  — per-client daily sends/replies/positive (from sp_daily_campaign_facts)
//   vw_cockpit_client_lifetime    — per-client all-time totals (from sp_campaign_lifetime)
//   vw_cockpit_client_capacity    — mailbox-derived send capacity
//   vw_cockpit_client_health_summary — lifecycle counts + avg warmup health
//   vw_cockpit_client_daily_facts — plugin-computed runway/capacity per day
//   vw_cockpit_client_runway      — PRIMARY-scoped runway + lead progress
//     (cockpit_read_models_007: follow-up/referral campaigns excluded, and
//     campaigns marked considered_done in cockpit_campaign_overrides don't
//     count — Omar's 2026-07-06 review)
//   vw_cockpit_freshness          — global "data as-of"
//
// client_analytics_config stays as the APP-OWNED targets/hierarchy table
// (daily targets, runway thresholds, parent/child) — it is config, not data.

// --- Row shapes from the views ---

interface PerfRow {
  client: string
  display_name: string | null
  snapshot_date: string
  emails_sent_count: number
  reply_count: number
  positive_replies_count: number
  bounced: number
  total_leads_in_campaigns: number
  leads_not_started: number
  leads_in_progress: number
  campaign_runway_days: number | null
  campaigns_reporting: number
}

interface LifetimeRow {
  client: string
  all_time_emails_sent: number
  all_time_replies: number
  all_time_interested: number
  campaign_count: number
}

interface CapacityRow {
  client: string
  active_daily_capacity: number
  total_send_capacity: number
  out_of_service_count: number
}

interface HealthSummaryRow {
  client: string
  active: number
  warming: number
  reserve: number
  resting: number
  parked: number
  burnt: number
  retired: number
  masters: number
  total: number
  avg_sending_health: number | null
}

interface ClientDailyFactsRow {
  client: string
  snapshot_date: string
  active_campaigns: number | null
  remaining_emails: number | null
  active_mailboxes: number | null
  active_daily_capacity: number | null
  runway_days: number | null
}

interface PrimaryRunwayRow {
  client: string
  primary_active_campaigns: number
  total_leads: number
  leads_not_started: number
  leads_in_progress: number
  leads_completed: number
  remaining_emails: number
  active_daily_capacity: number | null
  runway_days: number | string | null
  facts_date: string | null
}

// --- Helpers ---

function defaultConfig(slug: string, displayName?: string | null): ClientConfig {
  return {
    id: 0,
    client: slug,
    display_name:
      displayName ??
      slug
        .split(/[-_]/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
    parent_client: null,
    daily_email_target: 0,
    daily_targets: null,
    lead_table: null,
    lead_filter: null,
    smartlead_client_ids: [],
    runway_warning_days: 7,
    runway_critical_days: 3,
    is_active: true,
    created_at: "",
    updated_at: "",
  }
}

/**
 * Aggregate multiple ClientSnapshots into one by SUMming numeric fields
 * and taking MIN of runway days. Shared by Command Center and client detail.
 */
export function aggregateSnapshots(
  snapshots: ClientSnapshot[]
): ClientSnapshot | null {
  if (snapshots.length === 0) return null
  if (snapshots.length === 1) return snapshots[0]

  const base = { ...snapshots[0] }

  for (let i = 1; i < snapshots.length; i++) {
    const s = snapshots[i]
    base.emails_sent_count += s.emails_sent_count ?? 0
    base.positive_replies_count += s.positive_replies_count ?? 0
    base.ready_leads += s.ready_leads ?? 0
    base.qualified_no_email += s.qualified_no_email ?? 0
    base.total_leads_in_campaigns += s.total_leads_in_campaigns ?? 0
    base.unsent_campaign_leads += s.unsent_campaign_leads ?? 0
    base.subsequence_unsent += s.subsequence_unsent ?? 0
    base.mailbox_count += s.mailbox_count ?? 0
    base.estimated_max_capacity += s.estimated_max_capacity ?? 0
    base.daily_capacity += s.daily_capacity ?? 0
    base.daily_email_target += s.daily_email_target ?? 0
    base.all_time_emails_sent += s.all_time_emails_sent ?? 0
    base.all_time_interested += s.all_time_interested ?? 0
    base.all_time_replies = (base.all_time_replies ?? 0) + (s.all_time_replies ?? 0)
    base.active_mailboxes =
      (base.active_mailboxes ?? 0) + (s.active_mailboxes ?? 0)
    base.leads_not_started += s.leads_not_started ?? 0
    base.leads_in_progress += s.leads_in_progress ?? 0
    base.leads_completed += s.leads_completed ?? 0
    base.leads_blocked += s.leads_blocked ?? 0
    base.remaining_emails =
      (base.remaining_emails ?? 0) + (s.remaining_emails ?? 0)
    base.primary_active_campaigns =
      (base.primary_active_campaigns ?? 0) + (s.primary_active_campaigns ?? 0)
    base.total_runway_days = Math.min(
      base.total_runway_days ?? Infinity,
      s.total_runway_days ?? Infinity
    )
    base.campaign_runway_days = Math.min(
      base.campaign_runway_days ?? Infinity,
      s.campaign_runway_days ?? Infinity
    )
    base.pipeline_runway_days = Math.min(
      base.pipeline_runway_days ?? Infinity,
      s.pipeline_runway_days ?? Infinity
    )
  }

  base.hitting_target = base.emails_sent_count >= base.daily_email_target

  return base
}

/** Build a ClientSnapshot from the sp_* read-model rows. */
function buildSnapshot(params: {
  slug: string
  config: ClientConfig | null
  latestPerf: PerfRow | null
  periodSends?: number | null
  lifetime: LifetimeRow | null
  capacity: CapacityRow | null
  health: HealthSummaryRow | null
  dailyFacts: ClientDailyFactsRow | null
  primaryRunway?: PrimaryRunwayRow | null
  readyBank?: ReadyBankRow | null
}): ClientSnapshot | null {
  const { slug, config, latestPerf, periodSends, lifetime, capacity, health, dailyFacts, primaryRunway, readyBank } = params
  if (!latestPerf && !lifetime && !health) return null

  // Lead progress + runway are PRIMARY-scoped when the client has active
  // primary campaigns reporting (vw_cockpit_client_runway). Fallback to the
  // all-campaign perf/plugin numbers keeps the card from blanking for
  // clients with no active primaries (stability-first).
  const pr = primaryRunway ?? null
  const totalLeads =
    pr?.total_leads ?? latestPerf?.total_leads_in_campaigns ?? 0
  const notStarted = pr?.leads_not_started ?? latestPerf?.leads_not_started ?? 0
  const inProgress = pr?.leads_in_progress ?? latestPerf?.leads_in_progress ?? 0
  const completed =
    pr?.leads_completed ?? Math.max(0, totalLeads - notStarted - inProgress)
  const dailyCapacity =
    dailyFacts?.active_daily_capacity ?? capacity?.active_daily_capacity ?? 0
  const runway =
    pr?.runway_days != null
      ? Number(pr.runway_days)
      : dailyFacts?.runway_days ?? latestPerf?.campaign_runway_days ?? null
  const emailsSent = periodSends ?? latestPerf?.emails_sent_count ?? 0
  const target = config?.daily_email_target ?? 0
  const nonRetiredMailboxes = health
    ? Math.max(0, (health.total ?? 0) - (health.retired ?? 0))
    : dailyFacts?.active_mailboxes ?? 0

  return {
    client: slug,
    display_name:
      config?.display_name ?? latestPerf?.display_name ?? slug,
    parent_client: config?.parent_client ?? null,
    // Ready Bank counts from cockpit_ready_bank_daily (migration 010):
    // ready = verified email + not yet in a campaign; no-email = LinkedIn-only.
    ready_leads: readyBank?.available_email ?? 0,
    qualified_no_email: readyBank?.linkedin_only ?? 0,
    total_leads_in_campaigns: totalLeads,
    unsent_campaign_leads: notStarted,
    subsequence_unsent: 0,
    emails_sent_count: emailsSent,
    positive_replies_count: latestPerf?.positive_replies_count ?? 0,
    mailbox_count: nonRetiredMailboxes,
    estimated_max_capacity: capacity?.total_send_capacity ?? 0,
    daily_email_target: target,
    hitting_target: target > 0 ? emailsSent >= target : true,
    total_runway_days: runway ?? 999,
    campaign_runway_days: latestPerf?.campaign_runway_days ?? runway ?? 999,
    pipeline_runway_days: 999,
    daily_capacity: dailyCapacity,
    runway_warning_days: config?.runway_warning_days ?? 7,
    runway_critical_days: config?.runway_critical_days ?? 3,
    alert_types_sent: [],
    snapshot_date:
      latestPerf?.snapshot_date ??
      dailyFacts?.snapshot_date ??
      pr?.facts_date ??
      "",
    leads_not_started: notStarted,
    leads_in_progress: inProgress,
    leads_completed: completed,
    leads_blocked: 0,
    remaining_emails: pr?.remaining_emails ?? undefined,
    primary_active_campaigns: pr?.primary_active_campaigns ?? undefined,
    all_time_emails_sent: lifetime?.all_time_emails_sent ?? 0,
    all_time_interested: lifetime?.all_time_interested ?? 0,
    all_time_replies: lifetime?.all_time_replies ?? 0,
    active_mailboxes: health?.active ?? undefined,
  }
}

/** Fetch the standard bundle of per-client read-model rows. */
async function fetchClientBundles(slugs: string[]) {
  const supabase = createServerClient()

  const [lifetimeRes, capacityRes, healthRes, factsRes, primaryRunwayRes, readyBankBySlug] =
    await Promise.all([
      supabase.from("vw_cockpit_client_lifetime").select("*").in("client", slugs),
      supabase.from("vw_cockpit_client_capacity").select("*").in("client", slugs),
      supabase
        .from("vw_cockpit_client_health_summary")
        .select("*")
        .in("client", slugs),
      supabase
        .from("vw_cockpit_client_daily_facts")
        .select(
          "client, snapshot_date, active_campaigns, remaining_emails, active_mailboxes, active_daily_capacity, runway_days"
        )
        .in("client", slugs)
        .order("snapshot_date", { ascending: false })
        .limit(slugs.length * 8),
      supabase
        .from("vw_cockpit_client_runway")
        .select("*")
        .in("client", slugs),
      getReadyBankBySlug(slugs),
    ])

  const lifetimeByClient = new Map<string, LifetimeRow>()
  for (const r of (lifetimeRes.data ?? []) as LifetimeRow[]) {
    lifetimeByClient.set(r.client, r)
  }
  const capacityByClient = new Map<string, CapacityRow>()
  for (const r of (capacityRes.data ?? []) as CapacityRow[]) {
    capacityByClient.set(r.client, r)
  }
  const healthByClient = new Map<string, HealthSummaryRow>()
  for (const r of (healthRes.data ?? []) as HealthSummaryRow[]) {
    healthByClient.set(r.client, r)
  }
  const factsByClient = new Map<string, ClientDailyFactsRow>()
  for (const r of (factsRes.data ?? []) as ClientDailyFactsRow[]) {
    if (!factsByClient.has(r.client)) factsByClient.set(r.client, r)
  }
  const primaryRunwayByClient = new Map<string, PrimaryRunwayRow>()
  for (const r of (primaryRunwayRes.data ?? []) as PrimaryRunwayRow[]) {
    primaryRunwayByClient.set(r.client, r)
  }

  return {
    lifetimeByClient,
    capacityByClient,
    healthByClient,
    factsByClient,
    primaryRunwayByClient,
    readyBankBySlug,
  }
}

// --- Range anchoring (V2 Phase 3, RC-3) ---

/**
 * Latest business day with fact rows — the anchor every range counts back
 * from. Facts are business-day-only (the sync deliberately skips weekend
 * dates), so a calendar `today − days` cutoff matched ZERO rows all Sunday
 * and Monday and the Command Center read all zeros for ~48h every week.
 */
export const getLatestFactDate = cache(async (): Promise<string | null> => {
  const supabase = createServerClient()
  const { data } = await supabase
    .from("vw_cockpit_freshness")
    .select("latest_fact_date")
    .maybeSingle()
  return (data?.latest_fact_date as string | null) ?? null
})

/**
 * The `days` calendar days ENDING AT the latest BUSINESS day. days=1 → exactly
 * that business day ("Yesterday" — Fri when checked Sat/Sun/Mon, since weekend
 * fact rows are near-empty and must be skipped; Omar 2026-07-20). Callers
 * upper-bound their queries to `anchor` so trailing weekend rows after it are
 * excluded from the window.
 */
export async function rangeWindow(
  days: number
): Promise<{ cutoff: string; anchor: string | null }> {
  const raw = await getLatestFactDate()
  const anchor = raw ? toBusinessDay(raw) : null
  const end = anchor ? new Date(`${anchor}T00:00:00Z`) : new Date()
  end.setUTCDate(end.getUTCDate() - (days - 1))
  return { cutoff: end.toISOString().split("T")[0], anchor }
}

// --- Interfaces ---

export interface GlobalKPIs {
  emailsSentYesterday: number
  positiveReplies: number
  totalReplies: number
  overallReplyRate: number
  latestSnapshotDate: string | null
}

export interface ClientSummary {
  config: ClientConfig
  latest: ClientSnapshot | null
  alertCount: number
  /** Σ getTargetForDate over the FACT DATES in the selected range (weekday
      JSON respected). The old `daily_target × calendar days` compared 5
      business days of sends against 7 days of target (RC-5). */
  periodTarget: number
  /** Total replies in the range — reply-rate numerator (total replies,
      matching the Command Center KPI; RC-4). */
  periodReplies: number
  /** Positive replies (Interested + human-action-required) in the range —
      range-summed so the per-client breakdown sums to the headline KPI
      (V2 Phase 9 digest merge). */
  periodPositives: number
  /** Distinct people emailed in the range (cockpit_contacts_emailed RPC) —
      the denominator base for "contacts per positive reply" (V3 Phase 2). */
  periodContacts: number
}

export interface DailySendDataPoint {
  date: string
  totalSent: number
  target: number
}

// --- Functions ---

export const getGlobalKPIs = cache(async (days: number = 1): Promise<GlobalKPIs> => {
  const supabase = createServerClient()
  const activeSlugs = await getActiveClients()

  const { cutoff: cutoffStr, anchor } = await rangeWindow(days)

  const perfRes = await supabase
    .from("vw_cockpit_daily_client_perf")
    .select("client, snapshot_date, emails_sent_count, reply_count, positive_replies_count")
    .in("client", activeSlugs)
    .gte("snapshot_date", cutoffStr)
    // Bound to the business-day anchor so trailing weekend rows (near-empty)
    // don't leak into the window — days=1 = exactly the last business day.
    .lte("snapshot_date", anchor ?? cutoffStr)
    .order("snapshot_date", { ascending: false })

  let emailsSentPeriod = 0
  let positiveRepliesPeriod = 0
  let totalReplies = 0
  let latestSnapshotDate: string | null = null
  for (const r of (perfRes.data ?? []) as PerfRow[]) {
    emailsSentPeriod += r.emails_sent_count ?? 0
    positiveRepliesPeriod += r.positive_replies_count ?? 0
    totalReplies += r.reply_count ?? 0
    if (!latestSnapshotDate || r.snapshot_date > latestSnapshotDate) {
      latestSnapshotDate = r.snapshot_date
    }
  }

  // Reply rate answers the same question as the cards beside it: total
  // replies ÷ emails sent within the SELECTED RANGE — not all-time
  // (V2 Phase 1, walkthrough answer #4).
  const overallReplyRate =
    emailsSentPeriod > 0 ? (totalReplies / emailsSentPeriod) * 100 : 0

  return {
    emailsSentYesterday: emailsSentPeriod,
    positiveReplies: positiveRepliesPeriod,
    totalReplies,
    overallReplyRate,
    latestSnapshotDate,
  }
})

/**
 * Distinct people emailed per client over the selected range (V3 Phase 2,
 * B1/C1). Backed by the cockpit_contacts_emailed RPC — a true COUNT(DISTINCT
 * lead) over sp_send_events, because summing a daily view would double-count
 * anyone who got a follow-up (the exact gap "contacts per positive reply"
 * measures). Bounded to the same [cutoff, anchor] business-day window the
 * emails/positives KPIs use, so the ratio's numerator and denominator align.
 */
export const getContactsEmailed = cache(
  async (days: number = 1): Promise<Map<string, number>> => {
    const supabase = createServerClient()
    const activeSlugs = await getActiveClients()
    const { cutoff, anchor } = await rangeWindow(days)

    const { data, error } = await supabase.rpc("cockpit_contacts_emailed", {
      p_start: cutoff,
      p_end: anchor ?? cutoff,
    })

    const byClient = new Map<string, number>()
    if (error || !data) return byClient
    for (const r of data as { client: string; contacts_emailed: number }[]) {
      if (activeSlugs.includes(r.client)) {
        byClient.set(r.client, Number(r.contacts_emailed) || 0)
      }
    }
    return byClient
  }
)

export const getClientSummaries = cache(
  async (days: number = 1): Promise<ClientSummary[]> => {
    const supabase = createServerClient()

    const { cutoff: cutoffStr, anchor } = await rangeWindow(days)

    // 1. Active clients from sp_clients; targets/hierarchy from app config
    const activeSlugs = await getActiveClients()
    if (activeSlugs.length === 0) return []

    const { data: configRows } = await supabase
      .from("client_analytics_config")
      .select("*")
      .in("client", activeSlugs)

    const configBySlug = new Map<string, ClientConfig>()
    for (const c of (configRows ?? []) as ClientConfig[]) {
      configBySlug.set(c.client, c)
    }
    const configs: ClientConfig[] = activeSlugs.map(
      (slug) => configBySlug.get(slug) ?? defaultConfig(slug)
    )

    // 2. Perf rows in period + latest per client
    const { data: perfRows } = await supabase
      .from("vw_cockpit_daily_client_perf")
      .select("*")
      .in("client", activeSlugs)
      .gte("snapshot_date", cutoffStr)
      .lte("snapshot_date", anchor ?? cutoffStr)
      .order("snapshot_date", { ascending: false })

    const latestByClient = new Map<string, PerfRow>()
    const periodSendsByClient = new Map<string, number>()
    const periodRepliesByClient = new Map<string, number>()
    const periodPositivesByClient = new Map<string, number>()
    const factDatesByClient = new Map<string, string[]>()
    for (const r of (perfRows ?? []) as PerfRow[]) {
      if (!latestByClient.has(r.client)) latestByClient.set(r.client, r)
      periodSendsByClient.set(
        r.client,
        (periodSendsByClient.get(r.client) ?? 0) + (r.emails_sent_count ?? 0)
      )
      periodRepliesByClient.set(
        r.client,
        (periodRepliesByClient.get(r.client) ?? 0) + (r.reply_count ?? 0)
      )
      periodPositivesByClient.set(
        r.client,
        (periodPositivesByClient.get(r.client) ?? 0) + (r.positive_replies_count ?? 0)
      )
      const dates = factDatesByClient.get(r.client) ?? []
      dates.push(r.snapshot_date)
      factDatesByClient.set(r.client, dates)
    }

    // Period target = the client's target summed over the fact dates that
    // actually exist in the window (respects the daily_targets weekday JSON
    // the chart already used — RC-5). A client with no fact rows falls back
    // to one anchor-day target so "not sending" reads as red 0%, not "no
    // target set".
    const periodTargetFor = (config: ClientConfig): number => {
      const dates = factDatesByClient.get(config.client) ?? []
      const targets = (config.daily_targets as DailyTargets | null) ?? null
      if (dates.length === 0) {
        return anchor
          ? getTargetForDate(anchor, config.daily_email_target ?? 0, targets)
          : config.daily_email_target ?? 0
      }
      return dates.reduce(
        (sum, d) =>
          sum + getTargetForDate(d, config.daily_email_target ?? 0, targets),
        0
      )
    }

    // 3. Lifetime, capacity, health, plugin daily facts, primary runway
    const {
      lifetimeByClient,
      capacityByClient,
      healthByClient,
      factsByClient,
      primaryRunwayByClient,
      readyBankBySlug,
    } = await fetchClientBundles(activeSlugs)

    // 4. Open ACTIONABLE alert counts per client (migration 008)
    const { data: alertRows } = await supabase
      .from("vw_cockpit_alerts")
      .select("client")
      .eq("status", "open")
      .eq("tier", "actionable")
      .in("client", activeSlugs)

    const alertCounts = new Map<string, number>()
    for (const row of alertRows ?? []) {
      if (row.client) {
        alertCounts.set(row.client, (alertCounts.get(row.client) ?? 0) + 1)
      }
    }

    // Distinct contacts emailed per client in the range (V3 Phase 2 B1/C1).
    // cache()'d + request-deduped, so the Command Center's separate call
    // reuses this same result.
    const contactsByClient = await getContactsEmailed(days)

    const snapshotFor = (slug: string, config: ClientConfig | null) =>
      buildSnapshot({
        slug,
        config,
        latestPerf: latestByClient.get(slug) ?? null,
        periodSends: days > 1 ? periodSendsByClient.get(slug) ?? null : null,
        lifetime: lifetimeByClient.get(slug) ?? null,
        capacity: capacityByClient.get(slug) ?? null,
        health: healthByClient.get(slug) ?? null,
        dailyFacts: factsByClient.get(slug) ?? null,
        primaryRunway: primaryRunwayByClient.get(slug) ?? null,
        readyBank: readyBankBySlug.get(slug) ?? null,
      })

    // 5. Group by parent_client — children with the same parent become ONE summary
    const parentGroups = new Map<string, ClientConfig[]>()
    const standaloneConfigs: ClientConfig[] = []

    for (const config of configs) {
      if (config.parent_client) {
        const group = parentGroups.get(config.parent_client) ?? []
        group.push(config)
        parentGroups.set(config.parent_client, group)
      } else {
        standaloneConfigs.push(config)
      }
    }

    const summaries: ClientSummary[] = []

    for (const config of standaloneConfigs) {
      summaries.push({
        config,
        latest: snapshotFor(config.client, config),
        alertCount: alertCounts.get(config.client) ?? 0,
        periodTarget: periodTargetFor(config),
        periodReplies: periodRepliesByClient.get(config.client) ?? 0,
        periodPositives: periodPositivesByClient.get(config.client) ?? 0,
        periodContacts: contactsByClient.get(config.client) ?? 0,
      })
    }

    for (const [parentSlug, childConfigs] of parentGroups) {
      const parentConfig: ClientConfig = {
        ...childConfigs[0],
        client: parentSlug,
        display_name: parentSlug
          .split(/[-_]/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
        parent_client: null,
        daily_email_target: childConfigs.reduce(
          (sum, c) => sum + (c.daily_email_target ?? 0),
          0
        ),
        runway_warning_days: Math.min(
          ...childConfigs.map((c) => c.runway_warning_days)
        ),
        runway_critical_days: Math.min(
          ...childConfigs.map((c) => c.runway_critical_days)
        ),
      }

      const childSnapshots = childConfigs
        .map((c) => snapshotFor(c.client, c))
        .filter((s): s is ClientSnapshot => s != null)
      const aggregated = aggregateSnapshots(childSnapshots)
      if (aggregated) {
        aggregated.client = parentSlug
      }

      const totalAlerts = childConfigs.reduce(
        (sum, c) => sum + (alertCounts.get(c.client) ?? 0),
        0
      )

      summaries.push({
        config: parentConfig,
        latest: aggregated,
        alertCount: totalAlerts,
        periodTarget: childConfigs.reduce(
          (sum, c) => sum + periodTargetFor(c),
          0
        ),
        periodReplies: childConfigs.reduce(
          (sum, c) => sum + (periodRepliesByClient.get(c.client) ?? 0),
          0
        ),
        periodPositives: childConfigs.reduce(
          (sum, c) => sum + (periodPositivesByClient.get(c.client) ?? 0),
          0
        ),
        periodContacts: childConfigs.reduce(
          (sum, c) => sum + (contactsByClient.get(c.client) ?? 0),
          0
        ),
      })
    }

    return summaries
  }
)

/**
 * Latest aggregated snapshot for ONE client (resolving parent → children).
 * Used by the client detail page header/overview.
 */
export const getClientSnapshot = cache(
  async (client: string): Promise<ClientSnapshot | null> => {
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)

    const { cutoff } = await rangeWindow(14)

    const [{ data: perfRows }, bundles, { data: configRows }] =
      await Promise.all([
        supabase
          .from("vw_cockpit_daily_client_perf")
          .select("*")
          .in("client", slugs)
          .gte("snapshot_date", cutoff)
          .order("snapshot_date", { ascending: false }),
        fetchClientBundles(slugs),
        supabase
          .from("client_analytics_config")
          .select("*")
          .in("client", slugs),
      ])

    const latestByClient = new Map<string, PerfRow>()
    for (const r of (perfRows ?? []) as PerfRow[]) {
      if (!latestByClient.has(r.client)) latestByClient.set(r.client, r)
    }
    const configBySlug = new Map<string, ClientConfig>()
    for (const c of (configRows ?? []) as ClientConfig[]) {
      configBySlug.set(c.client, c)
    }

    const snaps = slugs
      .map((s) =>
        buildSnapshot({
          slug: s,
          config: configBySlug.get(s) ?? defaultConfig(s),
          latestPerf: latestByClient.get(s) ?? null,
          lifetime: bundles.lifetimeByClient.get(s) ?? null,
          capacity: bundles.capacityByClient.get(s) ?? null,
          health: bundles.healthByClient.get(s) ?? null,
          dailyFacts: bundles.factsByClient.get(s) ?? null,
          primaryRunway: bundles.primaryRunwayByClient.get(s) ?? null,
          readyBank: bundles.readyBankBySlug.get(s) ?? null,
        })
      )
      .filter((s): s is ClientSnapshot => s != null)

    const aggregated = aggregateSnapshots(snaps)
    if (aggregated) aggregated.client = client
    return aggregated
  }
)

// (getClientRecentHistory / getClientSendReplyHistory / getClientReplyHistory /
// getClientAnomalyHistory removed in V2 Phase 5 — the overview's fixed-window
// chart trio they fed was replaced by the range-driven suite reading
// getClientPerformanceHistory below.)

// --- Performance History (for time-range toggled metrics) ---

export interface PerformanceHistoryPoint {
  date: string
  emailsSent: number
  positiveReplies: number
  totalReplies: number
}

export const getClientPerformanceHistory = cache(
  async (client: string, days: number = 60): Promise<PerformanceHistoryPoint[]> => {
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)

    const { cutoff: cutoffStr } = await rangeWindow(days)

    const { data: rows } = await supabase
      .from("vw_cockpit_daily_client_perf")
      .select("snapshot_date, emails_sent_count, positive_replies_count, reply_count")
      .in("client", slugs)
      .gte("snapshot_date", cutoffStr)
      .order("snapshot_date", { ascending: true })

    const byDate = new Map<
      string,
      { sent: number; positive: number; total: number }
    >()
    for (const s of rows ?? []) {
      const existing =
        byDate.get(s.snapshot_date) ?? { sent: 0, positive: 0, total: 0 }
      existing.sent += s.emails_sent_count ?? 0
      existing.positive += s.positive_replies_count ?? 0
      existing.total += s.reply_count ?? 0
      byDate.set(s.snapshot_date, existing)
    }

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { sent, positive, total }]) => ({
        date,
        emailsSent: sent,
        positiveReplies: positive,
        totalReplies: total,
      }))
  }
)

// --- Comparison Data ---

export interface ComparisonDataPoint {
  date: string
  [client: string]: string | number // date is string, client values are numbers
}

export interface ClientComparisonData {
  sendVolume: ComparisonDataPoint[]
  replyRate: ComparisonDataPoint[]
  mailboxHealth: ComparisonDataPoint[]
}

export const getClientComparisonData = cache(
  async (clients: string[], days: number = 14): Promise<ClientComparisonData> => {
    const supabase = createServerClient()

    const { cutoff: cutoffStr } = await rangeWindow(days)

    const [{ data: perfRows }, { data: healthRows }] = await Promise.all([
      supabase
        .from("vw_cockpit_daily_client_perf")
        .select("client, snapshot_date, emails_sent_count, positive_replies_count")
        .in("client", clients)
        .gte("snapshot_date", cutoffStr)
        .order("snapshot_date", { ascending: true }),
      supabase
        .from("vw_cockpit_domain_health_daily")
        .select("client, snapshot_date, avg_health_pct")
        .in("client", clients)
        .gte("snapshot_date", cutoffStr),
    ])

    // Perf per date/client
    const dateMap = new Map<string, Map<string, { sent: number; replies: number }>>()
    for (const s of (perfRows ?? []) as PerfRow[]) {
      if (!dateMap.has(s.snapshot_date)) dateMap.set(s.snapshot_date, new Map())
      dateMap.get(s.snapshot_date)!.set(s.client, {
        sent: s.emails_sent_count ?? 0,
        replies: s.positive_replies_count ?? 0,
      })
    }

    // Real mailbox health (avg warmup) per date/client
    const healthMap = new Map<string, Map<string, { sum: number; count: number }>>()
    for (const h of healthRows ?? []) {
      if (h.avg_health_pct == null) continue
      if (!healthMap.has(h.snapshot_date)) healthMap.set(h.snapshot_date, new Map())
      const clientMap = healthMap.get(h.snapshot_date)!
      const entry = clientMap.get(h.client) ?? { sum: 0, count: 0 }
      entry.sum += Number(h.avg_health_pct)
      entry.count++
      clientMap.set(h.client, entry)
    }

    const allDates = new Set([...dateMap.keys(), ...healthMap.keys()])
    const sendVolume: ComparisonDataPoint[] = []
    const replyRate: ComparisonDataPoint[] = []
    const mailboxHealth: ComparisonDataPoint[] = []

    for (const date of Array.from(allDates).sort()) {
      const clientMap = dateMap.get(date)
      const healthClientMap = healthMap.get(date)
      const sendPoint: ComparisonDataPoint = { date }
      const replyPoint: ComparisonDataPoint = { date }
      const healthPoint: ComparisonDataPoint = { date }

      for (const client of clients) {
        const data = clientMap?.get(client)
        sendPoint[client] = data?.sent ?? 0
        replyPoint[client] =
          data && data.sent > 0
            ? Number(((data.replies / data.sent) * 100).toFixed(2))
            : 0
        const health = healthClientMap?.get(client)
        healthPoint[client] = health
          ? Number((health.sum / health.count).toFixed(1))
          : 0
      }

      sendVolume.push(sendPoint)
      replyRate.push(replyPoint)
      mailboxHealth.push(healthPoint)
    }

    return { sendVolume, replyRate, mailboxHealth }
  }
)

export const getDailySendHistory = cache(
  async (days: number = 14): Promise<DailySendDataPoint[]> => {
    const supabase = createServerClient()
    const activeSlugs = await getActiveClients()

    const { cutoff: cutoffStr, anchor } = await rangeWindow(days)

    const [{ data: configs }, { data: rows }] = await Promise.all([
      supabase
        .from("client_analytics_config")
        .select("client, daily_email_target, daily_targets")
        .in("client", activeSlugs),
      supabase
        .from("vw_cockpit_daily_client_perf")
        .select("snapshot_date, emails_sent_count")
        .in("client", activeSlugs)
        .gte("snapshot_date", cutoffStr)
        .lte("snapshot_date", anchor ?? cutoffStr)
        .order("snapshot_date", { ascending: true }),
    ])

    const byDate = new Map<string, number>()
    for (const s of rows ?? []) {
      byDate.set(
        s.snapshot_date,
        (byDate.get(s.snapshot_date) ?? 0) + (s.emails_sent_count ?? 0)
      )
    }

    const cfgs = configs ?? []
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, totalSent]) => {
        const combinedTarget = cfgs.reduce((sum, c) => {
          return (
            sum +
            getTargetForDate(
              date,
              c.daily_email_target ?? 0,
              (c.daily_targets as DailyTargets | null) ?? null
            )
          )
        }, 0)
        return { date, totalSent, target: combinedTarget }
      })
  }
)

// --- Today, live (webhook capture — NOT the daily source of truth) ---

export interface TodayLiveRow {
  client: string
  sends_today: number
  last_send_at: string | null
  campaigns_sending_today: number
  replies_today: number
  last_reply_at: string | null
}

/**
 * Intraday activity captured live by the smartlead-events Edge Function
 * (sp_send_events) + reply webhook (sp_replies). Complements — never
 * replaces — sp_daily_campaign_facts, which stays the daily source of truth.
 */
export const getTodayLive = cache(async (): Promise<TodayLiveRow[]> => {
  const supabase = createServerClient()
  const activeSlugs = await getActiveClients()

  const { data } = await supabase
    .from("vw_cockpit_today_live")
    .select("*")
    .in("client", activeSlugs)

  return (data ?? []) as TodayLiveRow[]
})

// --- Provider segmentation (sender infrastructure) ---

export interface ProviderSplitRow {
  provider: string
  sent: number
  replies: number
  replyRate: number
  repliesFromGoogle: number
  repliesFromMicrosoft: number
  repliesFromOther: number
}

export const getClientProviderSplit = cache(
  async (client: string, days: number = 14): Promise<ProviderSplitRow[]> => {
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)

    const { cutoff } = await rangeWindow(days)

    const { data } = await supabase
      .from("vw_cockpit_provider_daily")
      .select("*")
      .in("client", slugs)
      .gte("snapshot_date", cutoff)

    const byProvider = new Map<string, ProviderSplitRow>()
    for (const r of data ?? []) {
      const key = (r.sender_provider as string | null) ?? "other"
      const e =
        byProvider.get(key) ??
        ({
          provider: key,
          sent: 0,
          replies: 0,
          replyRate: 0,
          repliesFromGoogle: 0,
          repliesFromMicrosoft: 0,
          repliesFromOther: 0,
        } as ProviderSplitRow)
      e.sent += r.sent ?? 0
      e.replies += r.replies ?? 0
      e.repliesFromGoogle += r.replies_from_google ?? 0
      e.repliesFromMicrosoft += r.replies_from_microsoft ?? 0
      e.repliesFromOther += r.replies_from_other ?? 0
      byProvider.set(key, e)
    }

    return Array.from(byProvider.values())
      .map((e) => ({
        ...e,
        replyRate: e.sent > 0 ? (e.replies / e.sent) * 100 : 0,
      }))
      .sort((a, b) => b.sent - a.sent)
  }
)
