import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import { getActiveClients, resolveClientSlugs } from "@/lib/queries/clients"
import { getReadyBankBySlug, type ReadyBankRow } from "@/lib/queries/ready-bank"
import type { ClientConfig, ClientSnapshot, DailyTargets } from "@/types/analytics"
import { getTargetForDate } from "@/types/analytics"

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

// --- Interfaces ---

export interface GlobalKPIs {
  emailsSentYesterday: number
  positiveReplies: number
  totalReplies: number
  overallReplyRate: number
  activeAlerts: number
  capacityUtilization: number
  latestSnapshotDate: string | null
}

export interface ClientSummary {
  config: ClientConfig
  latest: ClientSnapshot | null
  alertCount: number
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

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split("T")[0]

  const [perfRes, lifetimeRes, capacityRes, alertsRes] = await Promise.all([
    supabase
      .from("vw_cockpit_daily_client_perf")
      .select("client, snapshot_date, emails_sent_count, reply_count, positive_replies_count")
      .in("client", activeSlugs)
      .gte("snapshot_date", cutoffStr)
      .order("snapshot_date", { ascending: false }),
    supabase
      .from("vw_cockpit_client_lifetime")
      .select("client, all_time_emails_sent, all_time_interested")
      .in("client", activeSlugs),
    supabase
      .from("vw_cockpit_client_capacity")
      .select("client, active_daily_capacity")
      .in("client", activeSlugs),
    supabase
      .from("vw_cockpit_alerts")
      .select("*", { count: "exact", head: true })
      .eq("status", "open")
      .eq("tier", "actionable"),
  ])

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

  let allTimeEmailsSent = 0
  let allTimeInterested = 0
  for (const r of (lifetimeRes.data ?? []) as LifetimeRow[]) {
    allTimeEmailsSent += r.all_time_emails_sent ?? 0
    allTimeInterested += r.all_time_interested ?? 0
  }

  const totalCapacity = ((capacityRes.data ?? []) as CapacityRow[]).reduce(
    (sum, r) => sum + (r.active_daily_capacity ?? 0),
    0
  )

  const overallReplyRate =
    allTimeEmailsSent > 0 ? (allTimeInterested / allTimeEmailsSent) * 100 : 0

  const avgDailySent = days > 0 ? emailsSentPeriod / days : emailsSentPeriod
  const capacityUtilization =
    totalCapacity > 0 ? (avgDailySent / totalCapacity) * 100 : 0

  return {
    emailsSentYesterday: emailsSentPeriod,
    positiveReplies: positiveRepliesPeriod,
    totalReplies,
    overallReplyRate,
    activeAlerts: alertsRes.count ?? 0,
    capacityUtilization,
    latestSnapshotDate,
  }
})

export const getClientSummaries = cache(
  async (days: number = 1): Promise<ClientSummary[]> => {
    const supabase = createServerClient()

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().split("T")[0]

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
      .order("snapshot_date", { ascending: false })

    const latestByClient = new Map<string, PerfRow>()
    const periodSendsByClient = new Map<string, number>()
    for (const r of (perfRows ?? []) as PerfRow[]) {
      if (!latestByClient.has(r.client)) latestByClient.set(r.client, r)
      periodSendsByClient.set(
        r.client,
        (periodSendsByClient.get(r.client) ?? 0) + (r.emails_sent_count ?? 0)
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

    const since = new Date()
    since.setDate(since.getDate() - 14)

    const [{ data: perfRows }, bundles, { data: configRows }] =
      await Promise.all([
        supabase
          .from("vw_cockpit_daily_client_perf")
          .select("*")
          .in("client", slugs)
          .gte("snapshot_date", since.toISOString().split("T")[0])
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

export interface ClientDailyDataPoint {
  date: string
  emailsSent: number
}

export const getClientRecentHistory = cache(
  async (client: string, days: number = 7): Promise<ClientDailyDataPoint[]> => {
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().split("T")[0]

    const { data: rows } = await supabase
      .from("vw_cockpit_daily_client_perf")
      .select("snapshot_date, emails_sent_count")
      .in("client", slugs)
      .gte("snapshot_date", cutoffStr)
      .order("snapshot_date", { ascending: true })

    const byDate = new Map<string, number>()
    for (const s of rows ?? []) {
      byDate.set(
        s.snapshot_date,
        (byDate.get(s.snapshot_date) ?? 0) + (s.emails_sent_count ?? 0)
      )
    }

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, emailsSent]) => ({ date, emailsSent }))
  }
)

export interface SendReplyDataPoint {
  date: string
  emailsSent: number
  positiveReplies: number
  replyRate: number
}

export const getClientSendReplyHistory = cache(
  async (client: string, days: number = 14): Promise<SendReplyDataPoint[]> => {
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().split("T")[0]

    const { data: rows } = await supabase
      .from("vw_cockpit_daily_client_perf")
      .select("snapshot_date, emails_sent_count, positive_replies_count")
      .in("client", slugs)
      .gte("snapshot_date", cutoffStr)
      .order("snapshot_date", { ascending: true })

    const byDate = new Map<string, { sent: number; replies: number }>()
    for (const s of rows ?? []) {
      const existing = byDate.get(s.snapshot_date) ?? { sent: 0, replies: 0 }
      existing.sent += s.emails_sent_count ?? 0
      existing.replies += s.positive_replies_count ?? 0
      byDate.set(s.snapshot_date, existing)
    }

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { sent, replies }]) => ({
        date,
        emailsSent: sent,
        positiveReplies: replies,
        replyRate: sent > 0 ? (replies / sent) * 100 : 0,
      }))
  }
)

export interface AnomalyHistoryPoint {
  date: string
  emailsSent: number
  positiveReplies: number
}

export const getClientAnomalyHistory = cache(
  async (client: string, days: number = 14): Promise<AnomalyHistoryPoint[]> => {
    const history = await getClientSendReplyHistory(client, days)
    return history.map((h) => ({
      date: h.date,
      emailsSent: h.emailsSent,
      positiveReplies: h.positiveReplies,
    }))
  }
)

// --- Reply History ---

export interface ReplyHistoryPoint {
  date: string
  positiveReplies: number
  otherReplies: number
  cumulativeInterested: number
}

/**
 * Daily positive + other replies for a client, straight from
 * vw_cockpit_daily_client_perf (sp_daily_campaign_facts has true daily
 * replies AND positive_replies — no more day-over-day delta reconstruction).
 */
export const getClientReplyHistory = cache(
  async (client: string, days: number = 30): Promise<{ history: ReplyHistoryPoint[]; totalInterested: number }> => {
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().split("T")[0]

    const [{ data: rows }, { data: lifetimeRows }] = await Promise.all([
      supabase
        .from("vw_cockpit_daily_client_perf")
        .select("snapshot_date, positive_replies_count, reply_count")
        .in("client", slugs)
        .gte("snapshot_date", cutoffStr)
        .order("snapshot_date", { ascending: true }),
      supabase
        .from("vw_cockpit_client_lifetime")
        .select("client, all_time_interested")
        .in("client", slugs),
    ])

    const byDate = new Map<string, { positive: number; total: number }>()
    for (const s of rows ?? []) {
      const existing = byDate.get(s.snapshot_date) ?? { positive: 0, total: 0 }
      existing.positive += s.positive_replies_count ?? 0
      existing.total += s.reply_count ?? 0
      byDate.set(s.snapshot_date, existing)
    }

    const totalInterested = (lifetimeRows ?? []).reduce(
      (sum, r) => sum + (r.all_time_interested ?? 0),
      0
    )

    let cumulative = 0
    const history: ReplyHistoryPoint[] = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { positive, total }]) => {
        cumulative += positive
        return {
          date,
          positiveReplies: positive,
          otherReplies: Math.max(0, total - positive),
          cumulativeInterested: cumulative,
        }
      })

    return { history, totalInterested }
  }
)

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

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().split("T")[0]

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

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().split("T")[0]

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

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().split("T")[0]

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

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    const { data } = await supabase
      .from("vw_cockpit_provider_daily")
      .select("*")
      .in("client", slugs)
      .gte("snapshot_date", cutoff.toISOString().split("T")[0])

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

// --- Digest ---

export interface DigestClientRow {
  client: string
  displayName: string
  emailsSent: number
  interestedReplies: number
  totalReplies: number
  replyRate: number
  allTimeEmailsSent: number
  allTimeInterested: number
}

export interface DigestData {
  date: string
  clients: DigestClientRow[]
  totalSent: number
  totalInterested: number
  totalReplies: number
  overallReplyRate: number
}

export const getDigestData = cache(async (): Promise<DigestData> => {
  const supabase = createServerClient()
  const activeSlugs = await getActiveClients()

  if (activeSlugs.length === 0)
    return {
      date: new Date().toISOString().split("T")[0],
      clients: [],
      totalSent: 0,
      totalInterested: 0,
      totalReplies: 0,
      overallReplyRate: 0,
    }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)

  const [{ data: configRows }, { data: perfRows }, { data: lifetimeRows }] =
    await Promise.all([
      supabase
        .from("client_analytics_config")
        .select("client, display_name, parent_client")
        .in("client", activeSlugs),
      supabase
        .from("vw_cockpit_daily_client_perf")
        .select("*")
        .in("client", activeSlugs)
        .gte("snapshot_date", cutoff.toISOString().split("T")[0])
        .order("snapshot_date", { ascending: false }),
      supabase
        .from("vw_cockpit_client_lifetime")
        .select("client, all_time_emails_sent, all_time_interested, all_time_replies")
        .in("client", activeSlugs),
    ])

  const configBySlug = new Map<
    string,
    { client: string; display_name: string | null; parent_client: string | null }
  >()
  for (const c of configRows ?? []) configBySlug.set(c.client, c)

  const latestByClient = new Map<string, PerfRow>()
  for (const s of (perfRows ?? []) as PerfRow[]) {
    if (!latestByClient.has(s.client)) latestByClient.set(s.client, s)
  }

  const lifetimeByClient = new Map<
    string,
    { all_time_emails_sent: number; all_time_interested: number; all_time_replies: number }
  >()
  for (const r of lifetimeRows ?? []) lifetimeByClient.set(r.client, r)

  // Group children into parents (via app config hierarchy)
  const parentGroups = new Map<string, string[]>()
  const standalones: string[] = []
  for (const slug of activeSlugs) {
    const parent = configBySlug.get(slug)?.parent_client
    if (parent) {
      const group = parentGroups.get(parent) ?? []
      group.push(slug)
      parentGroups.set(parent, group)
    } else {
      standalones.push(slug)
    }
  }

  const titleize = (slug: string) =>
    slug
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")

  function buildRow(
    slug: string,
    displayName: string,
    childSlugs: string[]
  ): DigestClientRow {
    let sent = 0,
      interested = 0,
      totalR = 0,
      allTimeSent = 0,
      allTimeInt = 0
    for (const cs of childSlugs) {
      const snap = latestByClient.get(cs)
      if (snap) {
        sent += snap.emails_sent_count ?? 0
        interested += snap.positive_replies_count ?? 0
      }
      const lt = lifetimeByClient.get(cs)
      if (lt) {
        allTimeSent += lt.all_time_emails_sent ?? 0
        allTimeInt += lt.all_time_interested ?? 0
        // "Total Replies" in the digest is lifetime (matches the old model)
        totalR += lt.all_time_replies ?? 0
      }
    }
    return {
      client: slug,
      displayName,
      emailsSent: sent,
      interestedReplies: interested,
      totalReplies: totalR,
      replyRate: allTimeSent > 0 ? (allTimeInt / allTimeSent) * 100 : 0,
      allTimeEmailsSent: allTimeSent,
      allTimeInterested: allTimeInt,
    }
  }

  const clientRows: DigestClientRow[] = []

  for (const slug of standalones) {
    if (parentGroups.has(slug)) continue
    const dn = configBySlug.get(slug)?.display_name ?? titleize(slug)
    clientRows.push(buildRow(slug, dn, [slug]))
  }

  for (const [parentSlug, children] of parentGroups) {
    clientRows.push(buildRow(parentSlug, titleize(parentSlug), children))
  }

  clientRows.sort((a, b) => b.emailsSent - a.emailsSent)

  const totalSent = clientRows.reduce((s, c) => s + c.emailsSent, 0)
  const totalInterested = clientRows.reduce((s, c) => s + c.interestedReplies, 0)
  const totalReplies = clientRows.reduce((s, c) => s + c.totalReplies, 0)
  const totalAllTimeSent = clientRows.reduce((s, c) => s + c.allTimeEmailsSent, 0)
  const totalAllTimeInt = clientRows.reduce((s, c) => s + c.allTimeInterested, 0)

  const latestDate = Array.from(latestByClient.values()).reduce<string | null>(
    (max, r) => (max === null || r.snapshot_date > max ? r.snapshot_date : max),
    null
  )

  return {
    date: latestDate ?? new Date().toISOString().split("T")[0],
    clients: clientRows,
    totalSent,
    totalInterested,
    totalReplies,
    overallReplyRate:
      totalAllTimeSent > 0 ? (totalAllTimeInt / totalAllTimeSent) * 100 : 0,
  }
})
