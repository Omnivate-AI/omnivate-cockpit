import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import { resolveClientSlugs } from "@/lib/queries/clients"
import type { ClientConfig, ClientSnapshot, DailyTargets } from "@/types/analytics"
import { getTargetForDate } from "@/types/analytics"

// --- Helpers ---

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
    // SUM fields
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
    // MIN for runway
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

  // Recompute hitting_target
  base.hitting_target = base.emails_sent_count >= base.daily_email_target

  return base
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

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split("T")[0]

  // Fetch snapshots within the period
  const { data: allSnapshots } = await supabase
    .from("analytics_snapshots")
    .select(
      "client, emails_sent_count, positive_replies_count, all_time_emails_sent, all_time_interested, estimated_max_capacity, snapshot_date"
    )
    .gte("snapshot_date", cutoffStr)
    .order("snapshot_date", { ascending: false })

  // For period sums: aggregate emails_sent_count and positive_replies_count across all dates
  // For all-time metrics (reply rate, capacity): use latest snapshot per client
  let emailsSentPeriod = 0
  let positiveRepliesPeriod = 0
  let allTimeEmailsSent = 0
  let allTimeInterested = 0
  let totalCapacity = 0

  const latestByClient = new Map<string, (typeof allSnapshots extends (infer T)[] | null ? T : never)>()
  if (allSnapshots) {
    for (const s of allSnapshots) {
      // Sum daily values across entire period
      emailsSentPeriod += s.emails_sent_count ?? 0
      positiveRepliesPeriod += s.positive_replies_count ?? 0

      // Keep latest per client for all-time metrics
      if (!latestByClient.has(s.client)) {
        latestByClient.set(s.client, s)
      }
    }
  }

  const latestSnapshots = Array.from(latestByClient.values())
  for (const s of latestSnapshots) {
    allTimeEmailsSent += s.all_time_emails_sent ?? 0
    allTimeInterested += s.all_time_interested ?? 0
    totalCapacity += s.estimated_max_capacity ?? 0
  }

  const overallReplyRate =
    allTimeEmailsSent > 0
      ? (allTimeInterested / allTimeEmailsSent) * 100
      : 0

  // Capacity utilization: use average daily sends in period
  const avgDailySent = days > 0 ? emailsSentPeriod / days : emailsSentPeriod
  const capacityUtilization =
    totalCapacity > 0
      ? (avgDailySent / totalCapacity) * 100
      : 0

  // Sum total replies from campaign_analytics_snapshots within the period
  // Use day-over-day deltas to get period total replies
  const { data: campaignSnapshots } = await supabase
    .from("campaign_analytics_snapshots")
    .select("campaign_id, reply_count, snapshot_date")
    .gte("snapshot_date", cutoffStr)
    .order("snapshot_date", { ascending: true })

  let totalReplies = 0
  if (campaignSnapshots && campaignSnapshots.length > 0) {
    // Group by campaign_id, compute deltas
    const byCampaign = new Map<number, { date: string; replyCount: number }[]>()
    for (const cs of campaignSnapshots) {
      const arr = byCampaign.get(cs.campaign_id) ?? []
      arr.push({ date: cs.snapshot_date, replyCount: cs.reply_count ?? 0 })
      byCampaign.set(cs.campaign_id, arr)
    }
    for (const [, entries] of byCampaign) {
      if (entries.length >= 2) {
        // Delta between latest and earliest in period
        const delta = entries[entries.length - 1].replyCount - entries[0].replyCount
        if (delta > 0) totalReplies += delta
      }
    }
    // Fallback: if only 1 snapshot per campaign, use latest reply_count from all-time
    if (totalReplies === 0) {
      const { data: latestCampaignSnaps } = await supabase
        .from("campaign_analytics_snapshots")
        .select("campaign_id, reply_count, snapshot_date")
        .order("snapshot_date", { ascending: false })
      const seenCampaigns = new Set<number>()
      if (latestCampaignSnaps) {
        for (const cs of latestCampaignSnaps) {
          if (!seenCampaigns.has(cs.campaign_id)) {
            seenCampaigns.add(cs.campaign_id)
            totalReplies += cs.reply_count ?? 0
          }
        }
      }
    }
  }

  // Count active alerts
  const { count: activeAlerts } = await supabase
    .from("mailbox_alerts")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")

  // Latest snapshot date across all clients
  const latestSnapshotDate = latestSnapshots.length > 0
    ? latestSnapshots[0].snapshot_date ?? null
    : null

  return {
    emailsSentYesterday: emailsSentPeriod,
    positiveReplies: positiveRepliesPeriod,
    totalReplies,
    overallReplyRate,
    activeAlerts: activeAlerts ?? 0,
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

    // 1. Get active client configs
    const { data: configs } = await supabase
      .from("client_analytics_config")
      .select("*")
      .eq("is_active", true)
      .order("client", { ascending: true })

    if (!configs || configs.length === 0) return []

    const clientSlugs = configs.map((c) => c.client)

    // 2. Get analytics snapshots within the period
    const { data: allSnapshots } = await supabase
      .from("analytics_snapshots")
      .select("*")
      .in("client", clientSlugs)
      .gte("snapshot_date", cutoffStr)
      .order("snapshot_date", { ascending: false })

    // Latest per client (for all-time fields) + sum period sends
    const latestByClient = new Map<string, ClientSnapshot>()
    const periodSendsByClient = new Map<string, number>()
    if (allSnapshots) {
      for (const s of allSnapshots) {
        if (!latestByClient.has(s.client)) {
          latestByClient.set(s.client, s as ClientSnapshot)
        }
        periodSendsByClient.set(
          s.client,
          (periodSendsByClient.get(s.client) ?? 0) + (s.emails_sent_count ?? 0)
        )
      }
    }

    // Override emails_sent_count on latest snapshot with period sum
    if (days > 1) {
      for (const [client, snap] of latestByClient) {
        snap.emails_sent_count = periodSendsByClient.get(client) ?? snap.emails_sent_count
      }
    }

    // 3. Count pending alerts per client
    const { data: alertRows } = await supabase
      .from("mailbox_alerts")
      .select("client:mailbox_domains(client)")
      .eq("status", "pending")

    const alertCounts = new Map<string, number>()
    if (alertRows) {
      for (const row of alertRows) {
        const client = (row.client as unknown as { client: string })?.client
        if (client) {
          alertCounts.set(client, (alertCounts.get(client) ?? 0) + 1)
        }
      }
    }

    // 4. Group by parent_client — children with the same parent become ONE summary
    const parentGroups = new Map<string, ClientConfig[]>()
    const standaloneConfigs: ClientConfig[] = []

    for (const config of configs as ClientConfig[]) {
      if (config.parent_client) {
        const group = parentGroups.get(config.parent_client) ?? []
        group.push(config)
        parentGroups.set(config.parent_client, group)
      } else {
        standaloneConfigs.push(config)
      }
    }

    const summaries: ClientSummary[] = []

    // 5. Add standalone summaries (clients without parent_client)
    for (const config of standaloneConfigs) {
      summaries.push({
        config,
        latest: latestByClient.get(config.client) ?? null,
        alertCount: alertCounts.get(config.client) ?? 0,
      })
    }

    // 6. Add aggregated parent summaries
    for (const [parentSlug, childConfigs] of parentGroups) {
      // Build a synthetic parent config
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

      // Aggregate latest snapshots from all children
      const childSnapshots = childConfigs
        .map((c) => latestByClient.get(c.client))
        .filter((s): s is ClientSnapshot => s != null)
      const aggregated = aggregateSnapshots(childSnapshots)
      if (aggregated) {
        aggregated.client = parentSlug
      }

      // Sum alert counts across children
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

    const { data: snapshots } = await supabase
      .from("analytics_snapshots")
      .select("snapshot_date, emails_sent_count")
      .in("client", slugs)
      .gte("snapshot_date", cutoffStr)
      .order("snapshot_date", { ascending: true })

    // Aggregate by date across child slugs
    const byDate = new Map<string, number>()
    for (const s of snapshots ?? []) {
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

    const { data: snapshots } = await supabase
      .from("analytics_snapshots")
      .select("snapshot_date, emails_sent_count, positive_replies_count")
      .in("client", slugs)
      .gte("snapshot_date", cutoffStr)
      .order("snapshot_date", { ascending: true })

    // Aggregate by date across child slugs
    const byDate = new Map<string, { sent: number; replies: number }>()
    for (const s of snapshots ?? []) {
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
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().split("T")[0]

    const { data: snapshots } = await supabase
      .from("analytics_snapshots")
      .select("snapshot_date, emails_sent_count, positive_replies_count")
      .in("client", slugs)
      .gte("snapshot_date", cutoffStr)
      .order("snapshot_date", { ascending: true })

    // Aggregate by date across child slugs
    const byDate = new Map<string, { sent: number; replies: number }>()
    for (const s of snapshots ?? []) {
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
 * Get daily positive replies and other replies for a client.
 * Positive replies from analytics_snapshots. Total replies computed as
 * day-over-day deltas from campaign_analytics_snapshots.reply_count.
 * Handles parent-client aggregation via resolveClientSlugs.
 */
export const getClientReplyHistory = cache(
  async (client: string, days: number = 30): Promise<{ history: ReplyHistoryPoint[]; totalInterested: number }> => {
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().split("T")[0]

    // 1. Daily positive replies from analytics_snapshots
    const { data: analyticsSnaps } = await supabase
      .from("analytics_snapshots")
      .select("snapshot_date, positive_replies_count")
      .in("client", slugs)
      .gte("snapshot_date", cutoffStr)
      .order("snapshot_date", { ascending: true })

    const positiveByDate = new Map<string, number>()
    for (const s of analyticsSnaps ?? []) {
      positiveByDate.set(
        s.snapshot_date,
        (positiveByDate.get(s.snapshot_date) ?? 0) + (s.positive_replies_count ?? 0)
      )
    }

    // 2. Total replies from campaign_analytics_snapshots (day-over-day deltas)
    const { data: campaigns } = await supabase
      .from("campaign_registry")
      .select("smartlead_campaign_id")
      .in("client", slugs)
      .eq("is_active", true)

    const totalReplyByDate = new Map<string, number>()
    if (campaigns && campaigns.length > 0) {
      const campaignIds = campaigns.map((c) => c.smartlead_campaign_id)

      const { data: campaignSnaps } = await supabase
        .from("campaign_analytics_snapshots")
        .select("campaign_id, snapshot_date, reply_count")
        .in("campaign_id", campaignIds)
        .gte("snapshot_date", cutoffStr)
        .order("snapshot_date", { ascending: true })

      if (campaignSnaps) {
        // Group by campaign_id, compute day-over-day deltas
        const byCampaign = new Map<number, { date: string; replyCount: number }[]>()
        for (const s of campaignSnaps) {
          const arr = byCampaign.get(s.campaign_id) ?? []
          arr.push({ date: s.snapshot_date, replyCount: s.reply_count ?? 0 })
          byCampaign.set(s.campaign_id, arr)
        }

        for (const [, entries] of byCampaign) {
          for (let i = 1; i < entries.length; i++) {
            const delta = entries[i].replyCount - entries[i - 1].replyCount
            if (delta > 0) {
              totalReplyByDate.set(
                entries[i].date,
                (totalReplyByDate.get(entries[i].date) ?? 0) + delta
              )
            }
          }
        }
      }
    }

    // 3. Get total interested from latest analytics snapshot per child slug
    const { data: latestSnaps } = await supabase
      .from("analytics_snapshots")
      .select("client, all_time_interested")
      .in("client", slugs)
      .order("snapshot_date", { ascending: false })

    let totalInterested = 0
    const seenSlugs = new Set<string>()
    for (const s of latestSnaps ?? []) {
      if (!seenSlugs.has(s.client)) {
        seenSlugs.add(s.client)
        totalInterested += s.all_time_interested ?? 0
      }
    }

    // 4. Combine into history with cumulative line
    const allDates = new Set([...positiveByDate.keys(), ...totalReplyByDate.keys()])
    const sortedDates = Array.from(allDates).sort()

    let cumulative = 0
    const history: ReplyHistoryPoint[] = sortedDates.map((date) => {
      const positive = positiveByDate.get(date) ?? 0
      const totalReplies = totalReplyByDate.get(date) ?? 0
      const other = Math.max(0, totalReplies - positive)
      cumulative += positive
      return { date, positiveReplies: positive, otherReplies: other, cumulativeInterested: cumulative }
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

/**
 * Get daily performance data for time-range comparison.
 * emailsSent and positiveReplies from analytics_snapshots.
 * totalReplies computed as day-over-day deltas from campaign_analytics_snapshots.reply_count.
 * Handles parent-client aggregation via resolveClientSlugs.
 */
export const getClientPerformanceHistory = cache(
  async (client: string, days: number = 60): Promise<PerformanceHistoryPoint[]> => {
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().split("T")[0]

    // 1. Daily sends + positive replies from analytics_snapshots
    const { data: analyticsSnaps } = await supabase
      .from("analytics_snapshots")
      .select("snapshot_date, emails_sent_count, positive_replies_count")
      .in("client", slugs)
      .gte("snapshot_date", cutoffStr)
      .order("snapshot_date", { ascending: true })

    const byDate = new Map<string, { sent: number; positive: number }>()
    for (const s of analyticsSnaps ?? []) {
      const existing = byDate.get(s.snapshot_date) ?? { sent: 0, positive: 0 }
      existing.sent += s.emails_sent_count ?? 0
      existing.positive += s.positive_replies_count ?? 0
      byDate.set(s.snapshot_date, existing)
    }

    // 2. Total replies from campaign_analytics_snapshots (day-over-day deltas)
    const { data: campaigns } = await supabase
      .from("campaign_registry")
      .select("smartlead_campaign_id")
      .in("client", slugs)
      .eq("is_active", true)

    const totalReplyByDate = new Map<string, number>()
    if (campaigns && campaigns.length > 0) {
      const campaignIds = campaigns.map((c) => c.smartlead_campaign_id)

      const { data: campaignSnaps } = await supabase
        .from("campaign_analytics_snapshots")
        .select("campaign_id, snapshot_date, reply_count")
        .in("campaign_id", campaignIds)
        .gte("snapshot_date", cutoffStr)
        .order("snapshot_date", { ascending: true })

      if (campaignSnaps) {
        const byCampaign = new Map<number, { date: string; replyCount: number }[]>()
        for (const s of campaignSnaps) {
          const arr = byCampaign.get(s.campaign_id) ?? []
          arr.push({ date: s.snapshot_date, replyCount: s.reply_count ?? 0 })
          byCampaign.set(s.campaign_id, arr)
        }

        for (const [, entries] of byCampaign) {
          for (let i = 1; i < entries.length; i++) {
            const delta = entries[i].replyCount - entries[i - 1].replyCount
            if (delta > 0) {
              totalReplyByDate.set(
                entries[i].date,
                (totalReplyByDate.get(entries[i].date) ?? 0) + delta
              )
            }
          }
        }
      }
    }

    // 3. Combine
    const allDates = new Set([...byDate.keys(), ...totalReplyByDate.keys()])
    return Array.from(allDates)
      .sort()
      .map((date) => {
        const analytics = byDate.get(date) ?? { sent: 0, positive: 0 }
        return {
          date,
          emailsSent: analytics.sent,
          positiveReplies: analytics.positive,
          totalReplies: totalReplyByDate.get(date) ?? 0,
        }
      })
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

    // Fetch analytics snapshots for selected clients
    const { data: snapshots } = await supabase
      .from("analytics_snapshots")
      .select(
        "client, snapshot_date, emails_sent_count, positive_replies_count, all_time_emails_sent, all_time_interested, estimated_max_capacity, daily_capacity"
      )
      .in("client", clients)
      .gte("snapshot_date", cutoffStr)
      .order("snapshot_date", { ascending: true })

    // Group by date
    const dateMap = new Map<string, Map<string, { sent: number; replies: number; health: number }>>()

    if (snapshots) {
      for (const s of snapshots) {
        if (!dateMap.has(s.snapshot_date)) {
          dateMap.set(s.snapshot_date, new Map())
        }
        const clientMap = dateMap.get(s.snapshot_date)!
        const sent = s.emails_sent_count ?? 0
        const replies = s.positive_replies_count ?? 0
        const capacity = s.estimated_max_capacity ?? 0
        const dailyCap = s.daily_capacity ?? 0
        // Use daily_capacity / estimated_max_capacity as health proxy
        const health = capacity > 0 ? (dailyCap / capacity) * 100 : 0
        clientMap.set(s.client, { sent, replies, health })
      }
    }

    const sendVolume: ComparisonDataPoint[] = []
    const replyRate: ComparisonDataPoint[] = []
    const mailboxHealth: ComparisonDataPoint[] = []

    for (const [date, clientMap] of dateMap) {
      const sendPoint: ComparisonDataPoint = { date }
      const replyPoint: ComparisonDataPoint = { date }
      const healthPoint: ComparisonDataPoint = { date }

      for (const client of clients) {
        const data = clientMap.get(client)
        sendPoint[client] = data?.sent ?? 0
        replyPoint[client] = data && data.sent > 0
          ? Number(((data.replies / data.sent) * 100).toFixed(2))
          : 0
        healthPoint[client] = data ? Number(data.health.toFixed(1)) : 0
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

    // Get active configs with per-day targets
    const { data: configs } = await supabase
      .from("client_analytics_config")
      .select("daily_email_target, daily_targets")
      .eq("is_active", true)

    // Get snapshots for the last N days across all clients
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().split("T")[0]

    const { data: snapshots } = await supabase
      .from("analytics_snapshots")
      .select("snapshot_date, emails_sent_count")
      .gte("snapshot_date", cutoffStr)
      .order("snapshot_date", { ascending: true })

    // Group by date and sum emails_sent_count
    const byDate = new Map<string, number>()
    if (snapshots) {
      for (const s of snapshots) {
        const d = s.snapshot_date
        byDate.set(d, (byDate.get(d) ?? 0) + (s.emails_sent_count ?? 0))
      }
    }

    // Compute combined target per date across all active configs
    const cfgs = configs ?? []
    return Array.from(byDate.entries()).map(([date, totalSent]) => {
      const combinedTarget = cfgs.reduce((sum, c) => {
        return sum + getTargetForDate(
          date,
          c.daily_email_target ?? 0,
          c.daily_targets as DailyTargets | null
        )
      }, 0)
      return { date, totalSent, target: combinedTarget }
    })
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

  // Get active client configs
  const { data: configs } = await supabase
    .from("client_analytics_config")
    .select("client, display_name, parent_client")
    .eq("is_active", true)

  if (!configs || configs.length === 0)
    return {
      date: new Date().toISOString().split("T")[0],
      clients: [],
      totalSent: 0,
      totalInterested: 0,
      totalReplies: 0,
      overallReplyRate: 0,
    }

  const allSlugs = configs.map((c) => c.client)

  // Latest analytics snapshot per client
  const { data: allSnapshots } = await supabase
    .from("analytics_snapshots")
    .select(
      "client, emails_sent_count, positive_replies_count, all_time_emails_sent, all_time_interested, snapshot_date"
    )
    .in("client", allSlugs)
    .order("snapshot_date", { ascending: false })

  const latestByClient = new Map<
    string,
    {
      emails_sent_count: number
      positive_replies_count: number
      all_time_emails_sent: number
      all_time_interested: number
      snapshot_date: string
    }
  >()
  if (allSnapshots) {
    for (const s of allSnapshots) {
      if (!latestByClient.has(s.client)) {
        latestByClient.set(s.client, s)
      }
    }
  }

  // Total replies from campaign_analytics_snapshots
  const { data: campaignSnaps } = await supabase
    .from("campaign_analytics_snapshots")
    .select("campaign_id, reply_count, snapshot_date, campaign_registry!inner(client)")
    .in("campaign_registry.client", allSlugs)
    .order("snapshot_date", { ascending: false })

  const repliesByClient = new Map<string, number>()
  const seenCampaigns = new Set<number>()
  if (campaignSnaps) {
    for (const cs of campaignSnaps) {
      if (!seenCampaigns.has(cs.campaign_id)) {
        seenCampaigns.add(cs.campaign_id)
        const client = (cs.campaign_registry as unknown as { client: string })?.client
        if (client) {
          repliesByClient.set(client, (repliesByClient.get(client) ?? 0) + (cs.reply_count ?? 0))
        }
      }
    }
  }

  // Group children into parents
  const parentGroups = new Map<string, typeof configs>()
  const standalones: typeof configs = []
  for (const c of configs) {
    if (c.parent_client) {
      const group = parentGroups.get(c.parent_client) ?? []
      group.push(c)
      parentGroups.set(c.parent_client, group)
    } else {
      standalones.push(c)
    }
  }

  const clientRows: DigestClientRow[] = []

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
        allTimeSent += snap.all_time_emails_sent ?? 0
        allTimeInt += snap.all_time_interested ?? 0
      }
      totalR += repliesByClient.get(cs) ?? 0
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

  // Standalone clients
  for (const c of standalones) {
    // Skip if this slug is actually a parent for a group (children exist)
    if (parentGroups.has(c.client)) continue
    const dn =
      c.display_name ??
      c.client
        .split(/[-_]/)
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    clientRows.push(buildRow(c.client, dn, [c.client]))
  }

  // Parent groups
  for (const [parentSlug, children] of parentGroups) {
    const dn = parentSlug
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
    clientRows.push(
      buildRow(
        parentSlug,
        dn,
        children.map((c) => c.client)
      )
    )
  }

  // Sort by emails sent descending
  clientRows.sort((a, b) => b.emailsSent - a.emailsSent)

  const totalSent = clientRows.reduce((s, c) => s + c.emailsSent, 0)
  const totalInterested = clientRows.reduce((s, c) => s + c.interestedReplies, 0)
  const totalReplies = clientRows.reduce((s, c) => s + c.totalReplies, 0)
  const totalAllTimeSent = clientRows.reduce((s, c) => s + c.allTimeEmailsSent, 0)
  const totalAllTimeInt = clientRows.reduce((s, c) => s + c.allTimeInterested, 0)

  return {
    date:
      allSnapshots && allSnapshots.length > 0
        ? allSnapshots[0].snapshot_date
        : new Date().toISOString().split("T")[0],
    clients: clientRows,
    totalSent,
    totalInterested,
    totalReplies,
    overallReplyRate:
      totalAllTimeSent > 0 ? (totalAllTimeInt / totalAllTimeSent) * 100 : 0,
  }
})
