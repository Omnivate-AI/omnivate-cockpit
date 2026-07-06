import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import { resolveClientSlugs } from "@/lib/queries/clients"
import type { CampaignSnapshot } from "@/types/analytics"

// Campaign reads come from:
//   vw_cockpit_campaigns      (sp_campaigns + lifetime totals)
//   vw_cockpit_campaign_daily (sp_daily_campaign_facts, keyed by SMARTLEAD id)
//   vw_cockpit_placement_results (sp_inbox_placement_tests/_results)
//   vw_cockpit_accounts       (roster membership via campaign_ids)

// --- Interfaces ---

export interface CampaignRegistryRow {
  id: number
  client: string
  smartlead_campaign_id: number
  campaign_name: string
  campaign_type: "primary" | "subsequence"
  /** primary | follow_up | referral — name heuristic + operator override
      (vw_cockpit_campaign_class, migration 007/009). Referrals classified
      correctly, unlike campaign_type. */
  campaign_class?: "primary" | "follow_up" | "referral"
  /** Operator marked this campaign finished — excluded from runway + alerts */
  considered_done?: boolean
  is_active: boolean
  status?: string
  sequence_length?: number | null
  // Lifetime stats from sp_campaign_lifetime (via vw_cockpit_campaigns)
  all_time_emails_sent?: number | null
  all_time_replies?: number | null
  all_time_interested?: number | null
  all_time_bounces?: number | null
  total_leads?: number | null
  not_started?: number | null
  in_progress?: number | null
  mailbox_count?: number | null
  last_synced_at?: string | null
}

export interface ClientCampaign extends CampaignRegistryRow {
  latest: CampaignSnapshot | null
}

export interface CampaignDetailPoint {
  snapshot_date: string
  total_leads: number
  emails_sent: number
  bounced: number
  positive_replies: number
  reply_count: number
  unsent_leads: number
  mailbox_count: number
  positive_reply_rate: number
  leads_not_started: number
  leads_in_progress: number
  leads_completed: number
  leads_blocked: number
  all_time_emails_sent: number
  all_time_interested: number
}

export interface PlacementTestResult {
  id: number
  test_id: string
  client: string
  smartlead_campaign_id: number
  campaign_name: string
  test_date: string
  run_no: number
  inbox_pct: number | null
  spam_pct: number | null
  missing_pct: number | null
  total_seeds: number | null
  provider_breakdown: Record<string, unknown> | null
}

export interface CampaignMailbox {
  id: number
  email: string
  domain_name: string
  client: string
  lifecycle_status: string
  warmup_health_pct: number | null
  platform: string | null
  is_master_inbox: boolean
}

// --- Helpers ---

/**
 * Build the campaign snapshot the table/cards render from LIFETIME stats
 * (sp_campaign_lifetime — Smartlead's own cumulative analytics). The old
 * app's campaign_analytics_snapshots were cumulative too; feeding daily
 * facts here made stale campaigns show "no data" and active ones show
 * single-day numbers.
 */
function lifetimeSnapshot(
  campaign: CampaignRegistryRow,
  latestFactDate: string | null
): CampaignSnapshot {
  const sent = campaign.all_time_emails_sent ?? 0
  const interested = campaign.all_time_interested ?? 0
  const totalLeads = campaign.total_leads ?? 0
  const notStarted = campaign.not_started ?? 0
  const inProgress = campaign.in_progress ?? 0

  return {
    campaign_id: campaign.smartlead_campaign_id,
    campaign_name: campaign.campaign_name,
    client: campaign.client,
    campaign_type: campaign.campaign_type,
    total_leads: totalLeads,
    emails_sent: sent,
    bounced: campaign.all_time_bounces ?? 0,
    positive_replies: interested,
    reply_count: campaign.all_time_replies ?? 0,
    unsent_leads: notStarted,
    mailbox_count: campaign.mailbox_count ?? 0,
    positive_reply_rate: sent > 0 ? (interested / sent) * 100 : 0,
    snapshot_date:
      latestFactDate ?? campaign.last_synced_at?.slice(0, 10) ?? "",
    leads_not_started: notStarted,
    leads_in_progress: inProgress,
    leads_completed: Math.max(0, totalLeads - notStarted - inProgress),
    leads_blocked: 0,
    leads_total_active: totalLeads,
    sequence_length: campaign.sequence_length ?? 0,
    all_time_emails_sent: sent,
    all_time_interested: interested,
  }
}

// --- Functions ---

export const getClientCampaigns = cache(
  async (
    client: string,
    scope: "active" | "all" = "active"
  ): Promise<ClientCampaign[]> => {
    const supabase = createServerClient()

    const slugs = await resolveClientSlugs(client)

    // 1. Campaigns with lifetime stats. scope="all" includes past campaigns
    //    (paused/completed/drafted/archived) — Omar 07-06: active AND past,
    //    with a toggle, so runs are comparable.
    let query = supabase
      .from("vw_cockpit_campaigns")
      .select("*")
      .in("client", slugs)
      .order("campaign_name", { ascending: true })
    if (scope === "active") {
      query = query.eq("is_active", true)
    }
    const { data: campaigns } = await query

    if (!campaigns || campaigns.length === 0) return []

    const campaignIds = campaigns.map((c) => c.smartlead_campaign_id)

    // 2. Latest daily-fact date per campaign (freshness badge only)
    const since = new Date()
    since.setDate(since.getDate() - 30)

    const { data: factDates } = await supabase
      .from("vw_cockpit_campaign_daily")
      .select("campaign_id, snapshot_date")
      .in("campaign_id", campaignIds)
      .gte("snapshot_date", since.toISOString().split("T")[0])
      .order("snapshot_date", { ascending: false })

    const latestDateByCampaign = new Map<number, string>()
    for (const s of factDates ?? []) {
      if (!latestDateByCampaign.has(s.campaign_id)) {
        latestDateByCampaign.set(s.campaign_id, s.snapshot_date)
      }
    }

    // 3. Combine — every campaign gets a snapshot (lifetime stats always exist)
    return (campaigns as CampaignRegistryRow[]).map((campaign) => ({
      ...campaign,
      latest: lifetimeSnapshot(
        campaign,
        latestDateByCampaign.get(campaign.smartlead_campaign_id) ?? null
      ),
    }))
  }
)

export const getCampaignDetail = cache(
  async (campaignId: number): Promise<CampaignDetailPoint[]> => {
    const supabase = createServerClient()

    const since = new Date()
    since.setDate(since.getDate() - 14)

    const { data } = await supabase
      .from("vw_cockpit_campaign_daily")
      .select(
        "snapshot_date, total_leads, emails_sent, bounced, positive_replies, reply_count, unsent_leads, mailbox_count, positive_reply_rate, leads_not_started, leads_in_progress, leads_completed, leads_blocked, all_time_emails_sent, all_time_interested"
      )
      .eq("campaign_id", campaignId)
      .gte("snapshot_date", since.toISOString().split("T")[0])
      .order("snapshot_date", { ascending: true })

    return (data ?? []) as CampaignDetailPoint[]
  }
)

/**
 * All-time replies for a client, from campaign lifetime stats.
 */
export const getClientTotalReplies = cache(
  async (client: string): Promise<number> => {
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)

    const { data } = await supabase
      .from("vw_cockpit_client_lifetime")
      .select("all_time_replies")
      .in("client", slugs)

    if (!data) return 0
    return data.reduce((sum, r) => sum + (r.all_time_replies ?? 0), 0)
  }
)

export const getCampaignMailboxes = cache(
  async (smartleadCampaignId: number): Promise<CampaignMailbox[]> => {
    const supabase = createServerClient()

    const { data } = await supabase
      .from("vw_cockpit_accounts")
      .select(
        "id, email, domain_name, client, lifecycle_status, warmup_health_pct, platform, is_master_inbox, campaign_ids"
      )
      .contains("campaign_ids", [smartleadCampaignId])
      .order("email", { ascending: true })

    if (!data) return []

    return data.map((a) => ({
      id: a.id,
      email: a.email,
      domain_name: a.domain_name ?? "",
      client: a.client,
      lifecycle_status: a.lifecycle_status,
      warmup_health_pct: a.warmup_health_pct,
      platform: a.platform,
      is_master_inbox: a.is_master_inbox,
    }))
  }
)

// Explicit column list — leaves out the bulky per_sender jsonb payload
const PLACEMENT_COLS =
  "id, test_id, client, smartlead_campaign_id, campaign_name, test_date, run_no, inbox_pct, spam_pct, missing_pct, total_seeds, provider_breakdown"

export const getCampaignPlacementResults = cache(
  async (smartleadCampaignId: number): Promise<PlacementTestResult | null> => {
    const supabase = createServerClient()

    const { data } = await supabase
      .from("vw_cockpit_placement_results")
      .select(PLACEMENT_COLS)
      .eq("smartlead_campaign_id", smartleadCampaignId)
      .order("test_date", { ascending: false })
      .limit(1)

    if (!data || data.length === 0) return null
    return data[0] as PlacementTestResult
  }
)

/**
 * Recent placement test results where spam_pct > threshold.
 * Used by Command Center spam risk banner.
 */
export const getRecentSpamRisks = cache(
  async (days: number = 7, limit: number = 3): Promise<PlacementTestResult[]> => {
    const supabase = createServerClient()

    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data } = await supabase
      .from("vw_cockpit_placement_results")
      .select(PLACEMENT_COLS)
      .gt("spam_pct", 10)
      .gte("test_date", since.toISOString().split("T")[0])
      .order("spam_pct", { ascending: false })
      .limit(limit)

    if (!data) return []
    return data as PlacementTestResult[]
  }
)

/**
 * Last 30 days of per-campaign history as CUMULATIVE series (the sparkline
 * component computes day-over-day deltas from these, matching the old
 * cumulative-snapshot model). Reconstructed from daily facts anchored to the
 * lifetime totals: baseline = lifetime − window sum, then a running sum.
 */
export const getClientCampaignSnapshots = cache(
  async (client: string): Promise<{ campaign_id: number; snapshot_date: string; all_time_emails_sent: number; all_time_interested: number; reply_count: number; positive_replies: number }[]> => {
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)

    const since = new Date()
    since.setDate(since.getDate() - 30)

    const [{ data: daily }, { data: lifetimes }] = await Promise.all([
      supabase
        .from("vw_cockpit_campaign_daily")
        .select(
          "campaign_id, snapshot_date, emails_sent, reply_count, positive_replies"
        )
        .in("client", slugs)
        .gte("snapshot_date", since.toISOString().split("T")[0])
        .order("snapshot_date", { ascending: true }),
      supabase
        .from("vw_cockpit_campaigns")
        .select(
          "smartlead_campaign_id, all_time_emails_sent, all_time_replies, all_time_interested"
        )
        .in("client", slugs),
    ])

    const lifetimeById = new Map<
      number,
      { sent: number; replies: number; interested: number }
    >()
    for (const l of lifetimes ?? []) {
      lifetimeById.set(l.smartlead_campaign_id, {
        sent: l.all_time_emails_sent ?? 0,
        replies: l.all_time_replies ?? 0,
        interested: l.all_time_interested ?? 0,
      })
    }

    // Group window rows per campaign (already date-ascending)
    const byCampaign = new Map<
      number,
      { snapshot_date: string; sent: number; replies: number; positive: number }[]
    >()
    for (const d of daily ?? []) {
      const arr = byCampaign.get(d.campaign_id) ?? []
      arr.push({
        snapshot_date: d.snapshot_date,
        sent: d.emails_sent ?? 0,
        replies: d.reply_count ?? 0,
        positive: d.positive_replies ?? 0,
      })
      byCampaign.set(d.campaign_id, arr)
    }

    const out: {
      campaign_id: number
      snapshot_date: string
      all_time_emails_sent: number
      all_time_interested: number
      reply_count: number
      positive_replies: number
    }[] = []

    for (const [campaignId, rows] of byCampaign) {
      const lifetime = lifetimeById.get(campaignId) ?? {
        sent: 0,
        replies: 0,
        interested: 0,
      }
      const windowSent = rows.reduce((s, r) => s + r.sent, 0)
      const windowReplies = rows.reduce((s, r) => s + r.replies, 0)
      const windowPositive = rows.reduce((s, r) => s + r.positive, 0)

      let cumSent = Math.max(0, lifetime.sent - windowSent)
      let cumReplies = Math.max(0, lifetime.replies - windowReplies)
      let cumInterested = Math.max(0, lifetime.interested - windowPositive)

      for (const r of rows) {
        cumSent += r.sent
        cumReplies += r.replies
        cumInterested += r.positive
        out.push({
          campaign_id: campaignId,
          snapshot_date: r.snapshot_date,
          all_time_emails_sent: cumSent,
          all_time_interested: cumInterested,
          reply_count: cumReplies,
          positive_replies: r.positive,
        })
      }
    }

    return out.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
  }
)

export const getClientPlacementResults = cache(
  async (client: string): Promise<PlacementTestResult[]> => {
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)

    const { data } = await supabase
      .from("vw_cockpit_placement_results")
      .select(PLACEMENT_COLS)
      .in("client", slugs)
      .order("test_date", { ascending: false })

    if (!data) return []
    return data as PlacementTestResult[]
  }
)
