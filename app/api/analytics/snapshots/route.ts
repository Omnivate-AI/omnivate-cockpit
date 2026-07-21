import { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { getActiveClients } from "@/lib/queries/clients"
import type {
  ClientConfig,
  ClientSnapshot,
  DailyPoint,
  CampaignSnapshot,
  SnapshotsResponse,
  CampaignHistoryResponse,
} from "@/types/analytics"

/**
 * GET /api/analytics/snapshots — latest snapshot + 14-day history per client + campaigns
 * GET /api/analytics/snapshots?campaign_id=xxx — 14-day history for one campaign
 *
 * All reads come from the sp_* read-models (vw_cockpit_*).
 */

interface CampaignDailyRow {
  campaign_id: number
  campaign_name: string
  client: string
  snapshot_date: string
  total_leads: number | null
  emails_sent: number | null
  bounced: number | null
  positive_replies: number | null
  reply_count: number | null
  unsent_leads: number | null
  mailbox_count: number | null
  positive_reply_rate: number | null
  leads_not_started: number | null
  leads_in_progress: number | null
  leads_completed: number | null
  leads_blocked: number | null
  all_time_emails_sent: number | null
  all_time_interested: number | null
}

function toCampaignSnapshot(
  row: CampaignDailyRow,
  campaignType: "primary" | "subsequence",
  sequenceLength: number
): CampaignSnapshot {
  return {
    campaign_id: row.campaign_id,
    campaign_name: row.campaign_name,
    client: row.client,
    campaign_type: campaignType,
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
    leads_total_active: row.total_leads ?? 0,
    sequence_length: sequenceLength,
    all_time_emails_sent: row.all_time_emails_sent ?? 0,
    all_time_interested: row.all_time_interested ?? 0,
    // Daily-fact rows carry no lifetime unique-contacts figure — the card
    // computes contacts-per-positive from the registry path instead.
    unique_contacts: null,
  }
}

export async function GET(request: NextRequest) {
  const campaignId = request.nextUrl.searchParams.get("campaign_id")

  const supabase = createServerClient()

  // Single-campaign history mode
  if (campaignId) {
    const numId = Number(campaignId)
    if (isNaN(numId)) {
      return Response.json({ error: "Invalid campaign_id" }, { status: 400 })
    }

    const [{ data, error }, { data: regRow }] = await Promise.all([
      supabase
        .from("vw_cockpit_campaign_daily")
        .select("*")
        .eq("campaign_id", numId)
        .order("snapshot_date", { ascending: false })
        .limit(14),
      supabase
        .from("vw_cockpit_campaigns")
        .select("campaign_type, sequence_length")
        .eq("smartlead_campaign_id", numId)
        .maybeSingle(),
    ])

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    const cType = (regRow?.campaign_type as "primary" | "subsequence") ?? "primary"
    const seqLen = regRow?.sequence_length ?? 3

    const history: CampaignSnapshot[] = [...(data || [])]
      .reverse()
      .map((row) => toCampaignSnapshot(row as CampaignDailyRow, cType, seqLen))

    const result: CampaignHistoryResponse = {
      campaign_id: numId,
      history,
    }
    return Response.json(result)
  }

  // Full dashboard mode — all active clients + campaigns

  const activeSlugs = await getActiveClients()

  const since = new Date()
  since.setDate(since.getDate() - 14)
  const sinceStr = since.toISOString().split("T")[0]

  const [
    { data: configRows },
    { data: perfRows, error: perfError },
    { data: lifetimeRows },
    { data: capacityRows },
    { data: factsRows },
    { data: campaignRows },
    { data: campaignMeta },
  ] = await Promise.all([
    supabase
      .from("client_analytics_config")
      .select("*")
      .in("client", activeSlugs),
    supabase
      .from("vw_cockpit_daily_client_perf")
      .select("*")
      .in("client", activeSlugs)
      .gte("snapshot_date", sinceStr)
      .order("snapshot_date", { ascending: false }),
    supabase
      .from("vw_cockpit_client_lifetime")
      .select("*")
      .in("client", activeSlugs),
    supabase
      .from("vw_cockpit_client_capacity")
      .select("*")
      .in("client", activeSlugs),
    supabase
      .from("vw_cockpit_client_daily_facts")
      .select("*")
      .in("client", activeSlugs)
      .order("snapshot_date", { ascending: false })
      .limit(activeSlugs.length * 4),
    supabase
      .from("vw_cockpit_campaign_daily")
      .select("*")
      .in("client", activeSlugs)
      .gte("snapshot_date", sinceStr)
      .order("snapshot_date", { ascending: false }),
    supabase
      .from("vw_cockpit_campaigns")
      .select("smartlead_campaign_id, campaign_type, sequence_length, is_active")
      .in("client", activeSlugs),
  ])

  if (perfError) {
    return Response.json({ error: perfError.message }, { status: 500 })
  }

  const configBySlug = new Map<string, ClientConfig>()
  for (const c of (configRows ?? []) as ClientConfig[]) configBySlug.set(c.client, c)

  const defaultConfig = (slug: string): ClientConfig => ({
    id: 0,
    client: slug,
    display_name: slug
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
  })

  const perfByClient = new Map<string, typeof perfRows>()
  for (const row of perfRows || []) {
    const existing = perfByClient.get(row.client) || []
    existing.push(row)
    perfByClient.set(row.client, existing)
  }

  const lifetimeByClient = new Map<
    string,
    { all_time_emails_sent: number; all_time_interested: number }
  >()
  for (const r of lifetimeRows ?? []) lifetimeByClient.set(r.client, r)
  const capacityByClient = new Map<
    string,
    { active_daily_capacity: number; total_send_capacity: number }
  >()
  for (const r of capacityRows ?? []) capacityByClient.set(r.client, r)
  const factsByClient = new Map<
    string,
    { active_daily_capacity: number | null; runway_days: number | null; active_mailboxes: number | null }
  >()
  for (const r of factsRows ?? []) {
    if (!factsByClient.has(r.client)) factsByClient.set(r.client, r)
  }

  const clients: SnapshotsResponse["clients"] = activeSlugs.map((slug) => {
    const cfg = configBySlug.get(slug) ?? defaultConfig(slug)
    const rows = perfByClient.get(slug) || []
    const latestRow = rows[0] || null
    const lifetime = lifetimeByClient.get(slug)
    const capacity = capacityByClient.get(slug)
    const facts = factsByClient.get(slug)

    const latest: ClientSnapshot | null = latestRow
      ? {
          client: slug,
          display_name: cfg.display_name,
          parent_client: cfg.parent_client,
          ready_leads: 0,
          qualified_no_email: 0,
          total_leads_in_campaigns: latestRow.total_leads_in_campaigns ?? 0,
          unsent_campaign_leads: latestRow.leads_not_started ?? 0,
          subsequence_unsent: 0,
          emails_sent_count: latestRow.emails_sent_count ?? 0,
          positive_replies_count: latestRow.positive_replies_count ?? 0,
          mailbox_count: facts?.active_mailboxes ?? 0,
          estimated_max_capacity: capacity?.total_send_capacity ?? 0,
          daily_email_target: cfg.daily_email_target,
          hitting_target:
            cfg.daily_email_target > 0
              ? (latestRow.emails_sent_count ?? 0) >= cfg.daily_email_target
              : true,
          total_runway_days: Number(
            facts?.runway_days ?? latestRow.campaign_runway_days ?? 999
          ),
          campaign_runway_days: Number(latestRow.campaign_runway_days ?? 999),
          pipeline_runway_days: 999,
          daily_capacity:
            facts?.active_daily_capacity ?? capacity?.active_daily_capacity ?? 0,
          runway_warning_days: cfg.runway_warning_days,
          runway_critical_days: cfg.runway_critical_days,
          alert_types_sent: [],
          snapshot_date: latestRow.snapshot_date,
          leads_not_started: latestRow.leads_not_started ?? 0,
          leads_in_progress: latestRow.leads_in_progress ?? 0,
          leads_completed: Math.max(
            0,
            (latestRow.total_leads_in_campaigns ?? 0) -
              (latestRow.leads_not_started ?? 0) -
              (latestRow.leads_in_progress ?? 0)
          ),
          leads_blocked: 0,
          all_time_emails_sent: lifetime?.all_time_emails_sent ?? 0,
          all_time_interested: lifetime?.all_time_interested ?? 0,
        }
      : null

    const historySlice = rows.slice(0, 14)
    const history: DailyPoint[] = [...historySlice].reverse().map((row) => ({
      date: row.snapshot_date,
      emails_sent_count: row.emails_sent_count ?? 0,
      positive_replies_count: row.positive_replies_count ?? 0,
      reply_count: row.reply_count ?? 0,
      bounced: row.bounced ?? 0,
      hitting_target:
        cfg.daily_email_target > 0
          ? (row.emails_sent_count ?? 0) >= cfg.daily_email_target
          : true,
      total_runway_days: Number(row.campaign_runway_days ?? 0),
    }))

    return { config: cfg, latest, history }
  })

  // Latest campaign snapshots (most recent fact per campaign)
  const typeBySmartleadId = new Map<
    number,
    { campaign_type: "primary" | "subsequence"; sequence_length: number }
  >()
  for (const r of campaignMeta ?? []) {
    typeBySmartleadId.set(r.smartlead_campaign_id, {
      campaign_type: (r.campaign_type as "primary" | "subsequence") ?? "primary",
      sequence_length: r.sequence_length ?? 3,
    })
  }

  const seenCampaigns = new Set<number>()
  const campaigns: CampaignSnapshot[] = []
  for (const row of (campaignRows ?? []) as CampaignDailyRow[]) {
    if (seenCampaigns.has(row.campaign_id)) continue
    seenCampaigns.add(row.campaign_id)
    const meta = typeBySmartleadId.get(row.campaign_id)
    campaigns.push(
      toCampaignSnapshot(
        row,
        meta?.campaign_type ?? "primary",
        meta?.sequence_length ?? 3
      )
    )
  }

  const result: SnapshotsResponse = { clients, campaigns }
  return Response.json(result)
}
