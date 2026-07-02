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
  is_active: boolean
  status?: string
  sequence_length?: number | null
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

type CampaignDailyRow = CampaignDetailPoint & {
  campaign_id: number
  campaign_name: string
  client: string
  snapshot_date: string
}

function toCampaignSnapshot(
  row: CampaignDailyRow,
  campaign: CampaignRegistryRow
): CampaignSnapshot {
  return {
    campaign_id: row.campaign_id,
    campaign_name: campaign.campaign_name,
    client: campaign.client,
    campaign_type: campaign.campaign_type,
    total_leads: row.total_leads ?? 0,
    emails_sent: row.emails_sent ?? 0,
    bounced: row.bounced ?? 0,
    positive_replies: row.positive_replies ?? 0,
    reply_count: row.reply_count ?? 0,
    unsent_leads: row.unsent_leads ?? 0,
    mailbox_count: row.mailbox_count ?? 0,
    positive_reply_rate: row.positive_reply_rate ?? 0,
    snapshot_date: row.snapshot_date,
    leads_not_started: row.leads_not_started ?? 0,
    leads_in_progress: row.leads_in_progress ?? 0,
    leads_completed: row.leads_completed ?? 0,
    leads_blocked: row.leads_blocked ?? 0,
    leads_total_active: row.total_leads ?? 0,
    sequence_length: campaign.sequence_length ?? 0,
    all_time_emails_sent: row.all_time_emails_sent ?? 0,
    all_time_interested: row.all_time_interested ?? 0,
  }
}

// --- Functions ---

export const getClientCampaigns = cache(
  async (client: string): Promise<ClientCampaign[]> => {
    const supabase = createServerClient()

    const slugs = await resolveClientSlugs(client)

    // 1. Active campaigns for this client (ACTIVE status in Smartlead)
    const { data: campaigns } = await supabase
      .from("vw_cockpit_campaigns")
      .select("*")
      .in("client", slugs)
      .eq("is_active", true)
      .order("campaign_name", { ascending: true })

    if (!campaigns || campaigns.length === 0) return []

    const campaignIds = campaigns.map((c) => c.smartlead_campaign_id)

    // 2. Latest daily fact per campaign (fetch recent window, dedupe in JS)
    const since = new Date()
    since.setDate(since.getDate() - 14)

    const { data: allSnapshots } = await supabase
      .from("vw_cockpit_campaign_daily")
      .select("*")
      .in("campaign_id", campaignIds)
      .gte("snapshot_date", since.toISOString().split("T")[0])
      .order("snapshot_date", { ascending: false })

    const latestByCampaign = new Map<number, CampaignDailyRow>()
    if (allSnapshots) {
      for (const s of allSnapshots as CampaignDailyRow[]) {
        if (!latestByCampaign.has(s.campaign_id)) {
          latestByCampaign.set(s.campaign_id, s)
        }
      }
    }

    // 3. Combine
    return (campaigns as CampaignRegistryRow[]).map((campaign) => {
      const latest = latestByCampaign.get(campaign.smartlead_campaign_id)
      return {
        ...campaign,
        latest: latest ? toCampaignSnapshot(latest, campaign) : null,
      }
    })
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
 * Last 30 days of daily facts for all active campaigns of a client.
 * Used to compute period-specific deltas (e.g., interested leads in last 7 days).
 */
export const getClientCampaignSnapshots = cache(
  async (client: string): Promise<{ campaign_id: number; snapshot_date: string; all_time_emails_sent: number; all_time_interested: number; reply_count: number; positive_replies: number }[]> => {
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)

    const since = new Date()
    since.setDate(since.getDate() - 30)

    const { data } = await supabase
      .from("vw_cockpit_campaign_daily")
      .select(
        "campaign_id, snapshot_date, all_time_emails_sent, all_time_interested, reply_count, positive_replies"
      )
      .in("client", slugs)
      .gte("snapshot_date", since.toISOString().split("T")[0])
      .order("snapshot_date", { ascending: true })

    return (data ?? []) as {
      campaign_id: number
      snapshot_date: string
      all_time_emails_sent: number
      all_time_interested: number
      reply_count: number
      positive_replies: number
    }[]
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
