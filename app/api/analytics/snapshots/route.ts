import { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import type {
  ClientConfig,
  ClientSnapshot,
  DailyPoint,
  CampaignSnapshot,
  SnapshotsResponse,
  CampaignHistoryResponse,
} from "@/types/analytics"

/**
 * GET /api/analytics/snapshots — fetch latest snapshot + 14-day history per client + campaigns
 * GET /api/analytics/snapshots?campaign_id=xxx — fetch 14-day history for one campaign
 */

export async function GET(request: NextRequest) {
  const campaignId = request.nextUrl.searchParams.get("campaign_id")

  const supabase = createServerClient()

  // Single-campaign history mode
  if (campaignId) {
    const numId = Number(campaignId)
    if (isNaN(numId)) {
      return Response.json({ error: "Invalid campaign_id" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("campaign_analytics_snapshots")
      .select("*")
      .eq("campaign_id", numId)
      .order("snapshot_date", { ascending: false })
      .limit(14)

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    // Fetch campaign_type from campaign_registry for this campaign
    const { data: regRow } = await supabase
      .from("campaign_registry")
      .select("campaign_type")
      .eq("id", numId)
      .maybeSingle()

    const cType = (regRow?.campaign_type as "primary" | "subsequence") ?? "primary"

    const history: CampaignSnapshot[] = [...(data || [])].reverse().map((row) => ({
      campaign_id: row.campaign_id,
      campaign_name: row.campaign_name,
      client: row.client,
      campaign_type: cType,
      total_leads: row.total_leads ?? 0,
      emails_sent: row.emails_sent ?? 0,
      bounced: row.bounced ?? 0,
      positive_replies: row.positive_replies ?? 0,
      reply_count: row.reply_count ?? 0,
      unsent_leads: row.unsent_leads ?? 0,
      mailbox_count: row.mailbox_count ?? 0,
      positive_reply_rate: Number(row.positive_reply_rate ?? 0),
      snapshot_date: row.snapshot_date,
      leads_not_started: row.leads_not_started ?? 0,
      leads_in_progress: row.leads_in_progress ?? 0,
      leads_completed: row.leads_completed ?? 0,
      leads_blocked: row.leads_blocked ?? 0,
      leads_total_active: row.leads_total_active ?? 0,
      sequence_length: row.sequence_length ?? 3,
      all_time_emails_sent: row.all_time_emails_sent ?? 0,
      all_time_interested: row.all_time_interested ?? 0,
    }))

    const result: CampaignHistoryResponse = {
      campaign_id: numId,
      history,
    }
    return Response.json(result)
  }

  // Full dashboard mode — all clients + campaigns

  // 1. Load client configs
  const { data: configs, error: configError } = await supabase
    .from("client_analytics_config")
    .select("*")
    .eq("is_active", true)
    .order("display_name")

  if (configError) {
    return Response.json({ error: configError.message }, { status: 500 })
  }

  const activeConfigs = (configs || []) as ClientConfig[]

  // 2. Fetch ALL snapshots for the last 14 days in a single query (covers both latest + history)
  const clientSlugs = activeConfigs.map((c) => c.client)
  const { data: allSnapshotRows, error: snapError } = await supabase
    .from("analytics_snapshots")
    .select("*")
    .in("client", clientSlugs)
    .order("snapshot_date", { ascending: false })
    .limit(clientSlugs.length * 14)

  if (snapError) {
    return Response.json({ error: snapError.message }, { status: 500 })
  }

  // Group snapshots by client
  const snapshotsByClient = new Map<string, typeof allSnapshotRows>()
  for (const row of allSnapshotRows || []) {
    const existing = snapshotsByClient.get(row.client) || []
    existing.push(row)
    snapshotsByClient.set(row.client, existing)
  }

  // 3. Build per-client response from grouped data
  const clients: SnapshotsResponse["clients"] = activeConfigs.map((cfg) => {
    const rows = snapshotsByClient.get(cfg.client) || []
    // rows are already ordered by snapshot_date DESC — first row is the latest
    const latestRow = rows[0] || null

    const latest: ClientSnapshot | null = latestRow
      ? {
          client: latestRow.client,
          display_name: cfg.display_name,
          parent_client: cfg.parent_client,
          ready_leads: latestRow.ready_leads ?? 0,
          qualified_no_email: latestRow.qualified_no_email ?? 0,
          total_leads_in_campaigns: latestRow.total_leads_in_campaigns ?? 0,
          unsent_campaign_leads: latestRow.unsent_campaign_leads ?? 0,
          subsequence_unsent: latestRow.subsequence_unsent ?? 0,
          emails_sent_count: latestRow.emails_sent_count ?? 0,
          positive_replies_count: latestRow.positive_replies_count ?? 0,
          mailbox_count: latestRow.mailbox_count ?? 0,
          estimated_max_capacity: latestRow.estimated_max_capacity ?? 0,
          daily_email_target: latestRow.daily_email_target ?? cfg.daily_email_target,
          hitting_target: latestRow.hitting_target ?? false,
          total_runway_days: Number(latestRow.total_runway_days ?? 0),
          campaign_runway_days: Number(latestRow.campaign_runway_days ?? 0),
          pipeline_runway_days: Number(latestRow.pipeline_runway_days ?? 0),
          daily_capacity: latestRow.daily_capacity ?? 0,
          runway_warning_days: cfg.runway_warning_days,
          runway_critical_days: cfg.runway_critical_days,
          alert_types_sent: latestRow.alert_types_sent ?? [],
          snapshot_date: latestRow.snapshot_date,
          leads_not_started: latestRow.leads_not_started ?? 0,
          leads_in_progress: latestRow.leads_in_progress ?? 0,
          leads_completed: latestRow.leads_completed ?? 0,
          leads_blocked: latestRow.leads_blocked ?? 0,
          all_time_emails_sent: latestRow.all_time_emails_sent ?? 0,
          all_time_interested: latestRow.all_time_interested ?? 0,
        }
      : null

    // Take up to 14 most recent rows, reverse to chronological order
    const historySlice = rows.slice(0, 14)
    const history: DailyPoint[] = [...historySlice].reverse().map((row) => ({
      date: row.snapshot_date,
      emails_sent_count: row.emails_sent_count ?? 0,
      positive_replies_count: row.positive_replies_count ?? 0,
      reply_count: 0, // Not stored in analytics_snapshots; available via campaign snapshots
      bounced: 0,
      hitting_target: row.hitting_target ?? false,
      total_runway_days: Number(row.total_runway_days ?? 0),
    }))

    return { config: cfg, latest, history }
  })

  // 4. Latest campaign snapshots (most recent date, all active campaigns)
  const { data: campaignRows } = await supabase
    .from("campaign_analytics_snapshots")
    .select("*")
    .order("snapshot_date", { ascending: false })

  // Fetch campaign_type from campaign_registry
  const { data: registryRows } = await supabase
    .from("campaign_registry")
    .select("id, campaign_type")

  const campaignTypeMap = new Map<number, "primary" | "subsequence">()
  for (const r of registryRows || []) {
    campaignTypeMap.set(r.id, r.campaign_type as "primary" | "subsequence")
  }

  // Deduplicate: keep only the latest snapshot per campaign_id
  const seenCampaigns = new Set<number>()
  const campaigns: CampaignSnapshot[] = []
  for (const row of campaignRows || []) {
    if (seenCampaigns.has(row.campaign_id)) continue
    seenCampaigns.add(row.campaign_id)
    campaigns.push({
      campaign_id: row.campaign_id,
      campaign_name: row.campaign_name,
      client: row.client,
      campaign_type: campaignTypeMap.get(row.campaign_id) ?? "primary",
      total_leads: row.total_leads ?? 0,
      emails_sent: row.emails_sent ?? 0,
      bounced: row.bounced ?? 0,
      positive_replies: row.positive_replies ?? 0,
      reply_count: row.reply_count ?? 0,
      unsent_leads: row.unsent_leads ?? 0,
      mailbox_count: row.mailbox_count ?? 0,
      positive_reply_rate: Number(row.positive_reply_rate ?? 0),
      snapshot_date: row.snapshot_date,
      leads_not_started: row.leads_not_started ?? 0,
      leads_in_progress: row.leads_in_progress ?? 0,
      leads_completed: row.leads_completed ?? 0,
      leads_blocked: row.leads_blocked ?? 0,
      leads_total_active: row.leads_total_active ?? 0,
      sequence_length: row.sequence_length ?? 3,
      all_time_emails_sent: row.all_time_emails_sent ?? 0,
      all_time_interested: row.all_time_interested ?? 0,
    })
  }

  const result: SnapshotsResponse = { clients, campaigns }
  return Response.json(result)
}
