import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import { resolveClientSlugs } from "@/lib/queries/clients"
import type { CampaignSnapshot } from "@/types/analytics"

// --- Interfaces ---

export interface CampaignRegistryRow {
  id: number
  client: string
  smartlead_campaign_id: number
  campaign_name: string
  campaign_type: "primary" | "subsequence"
  is_active: boolean
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

// --- Functions ---

export const getClientCampaigns = cache(
  async (client: string): Promise<ClientCampaign[]> => {
    const supabase = createServerClient()

    // Resolve parent-client to child slugs (e.g., roosterpunk → roosterpunk_us, roosterpunk_uk)
    const slugs = await resolveClientSlugs(client)

    // 1. Get active campaigns for this client (and child slugs)
    const { data: campaigns } = await supabase
      .from("campaign_registry")
      .select("*")
      .in("client", slugs)
      .eq("is_active", true)
      .order("campaign_name", { ascending: true })

    if (!campaigns || campaigns.length === 0) return []

    const campaignIds = campaigns.map((c) => c.smartlead_campaign_id)

    // 2. Get latest snapshot per campaign (fetch all, deduplicate in JS)
    const { data: allSnapshots } = await supabase
      .from("campaign_analytics_snapshots")
      .select("*")
      .in("campaign_id", campaignIds)
      .order("snapshot_date", { ascending: false })

    const latestByCampaign = new Map<number, CampaignSnapshot>()
    if (allSnapshots) {
      for (const s of allSnapshots) {
        if (!latestByCampaign.has(s.campaign_id)) {
          latestByCampaign.set(s.campaign_id, s as CampaignSnapshot)
        }
      }
    }

    // 3. Combine
    return (campaigns as CampaignRegistryRow[]).map((campaign) => ({
      ...campaign,
      latest: latestByCampaign.get(campaign.smartlead_campaign_id) ?? null,
    }))
  }
)

export const getCampaignDetail = cache(
  async (campaignId: number): Promise<CampaignDetailPoint[]> => {
    const supabase = createServerClient()

    const since = new Date()
    since.setDate(since.getDate() - 14)

    const { data } = await supabase
      .from("campaign_analytics_snapshots")
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
 * Sum reply_count from latest campaign_analytics_snapshots for a client.
 * analytics_snapshots doesn't store reply_count, so we aggregate from campaign-level data.
 */
export const getClientTotalReplies = cache(
  async (client: string): Promise<number> => {
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)

    const { data: campaigns } = await supabase
      .from("campaign_registry")
      .select("smartlead_campaign_id")
      .in("client", slugs)
      .eq("is_active", true)

    if (!campaigns || campaigns.length === 0) return 0

    const campaignIds = campaigns.map((c) => c.smartlead_campaign_id)

    const { data: snapshots } = await supabase
      .from("campaign_analytics_snapshots")
      .select("campaign_id, reply_count, snapshot_date")
      .in("campaign_id", campaignIds)
      .order("snapshot_date", { ascending: false })

    let total = 0
    const seen = new Set<number>()
    if (snapshots) {
      for (const s of snapshots) {
        if (!seen.has(s.campaign_id)) {
          seen.add(s.campaign_id)
          total += s.reply_count ?? 0
        }
      }
    }
    return total
  }
)

export const getCampaignMailboxes = cache(
  async (smartleadCampaignId: number): Promise<CampaignMailbox[]> => {
    const supabase = createServerClient()

    const { data } = await supabase
      .from("mailbox_accounts")
      .select(
        "id, email, domain_name, client, lifecycle_status, warmup_health_pct, platform, is_master_inbox, campaign_ids"
      )
      .contains("campaign_ids", [smartleadCampaignId])
      .order("email", { ascending: true })

    if (!data) return []

    return data.map((a) => ({
      id: a.id,
      email: a.email,
      domain_name: a.domain_name,
      client: a.client,
      lifecycle_status: a.lifecycle_status,
      warmup_health_pct: a.warmup_health_pct,
      platform: a.platform,
      is_master_inbox: a.is_master_inbox,
    }))
  }
)

export const getCampaignPlacementResults = cache(
  async (smartleadCampaignId: number): Promise<PlacementTestResult | null> => {
    const supabase = createServerClient()

    const { data } = await supabase
      .from("placement_test_results")
      .select("*")
      .eq("smartlead_campaign_id", smartleadCampaignId)
      .order("test_date", { ascending: false })
      .limit(1)

    if (!data || data.length === 0) return null
    return data[0] as PlacementTestResult
  }
)

/**
 * Get recent placement test results where spam_pct > threshold.
 * Used by Command Center spam risk banner.
 */
export const getRecentSpamRisks = cache(
  async (days: number = 7, limit: number = 3): Promise<PlacementTestResult[]> => {
    const supabase = createServerClient()

    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data } = await supabase
      .from("placement_test_results")
      .select("*")
      .gt("spam_pct", 10)
      .gte("test_date", since.toISOString().split("T")[0])
      .order("spam_pct", { ascending: false })
      .limit(limit)

    if (!data) return []
    return data as PlacementTestResult[]
  }
)

/**
 * Fetch last 30 days of campaign_analytics_snapshots for all active campaigns of a client.
 * Used to compute period-specific deltas (e.g., interested leads in last 7 days).
 */
export const getClientCampaignSnapshots = cache(
  async (client: string): Promise<{ campaign_id: number; snapshot_date: string; all_time_emails_sent: number; all_time_interested: number; reply_count: number }[]> => {
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)

    const { data: campaigns } = await supabase
      .from("campaign_registry")
      .select("smartlead_campaign_id")
      .in("client", slugs)
      .eq("is_active", true)

    if (!campaigns || campaigns.length === 0) return []

    const campaignIds = campaigns.map((c) => c.smartlead_campaign_id)

    const since = new Date()
    since.setDate(since.getDate() - 30)

    const { data } = await supabase
      .from("campaign_analytics_snapshots")
      .select("campaign_id, snapshot_date, all_time_emails_sent, all_time_interested, reply_count")
      .in("campaign_id", campaignIds)
      .gte("snapshot_date", since.toISOString().split("T")[0])
      .order("snapshot_date", { ascending: true })

    return (data ?? []) as { campaign_id: number; snapshot_date: string; all_time_emails_sent: number; all_time_interested: number; reply_count: number }[]
  }
)

export const getClientPlacementResults = cache(
  async (client: string): Promise<PlacementTestResult[]> => {
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)

    const { data } = await supabase
      .from("placement_test_results")
      .select("*")
      .in("client", slugs)
      .order("test_date", { ascending: false })

    if (!data) return []
    return data as PlacementTestResult[]
  }
)
