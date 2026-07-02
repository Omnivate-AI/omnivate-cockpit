import { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import type { CampaignDetailPoint, CampaignMailbox, PlacementTestResult } from "@/lib/queries/campaigns"

/**
 * GET /api/campaigns/[id]/detail — fetch 14-day history + attached mailboxes for a campaign.
 * `id` is the smartlead_campaign_id from campaign_registry.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const campaignId = Number(id)
  if (isNaN(campaignId)) {
    return Response.json({ error: "Invalid campaign id" }, { status: 400 })
  }

  const supabase = createServerClient()

  const since = new Date()
  since.setDate(since.getDate() - 14)
  const sinceStr = since.toISOString().split("T")[0]

  // Fetch history, mailboxes, and placement results in parallel
  const [historyRes, mailboxRes, placementRes] = await Promise.all([
    supabase
      .from("campaign_analytics_snapshots")
      .select(
        "snapshot_date, total_leads, emails_sent, bounced, positive_replies, reply_count, unsent_leads, mailbox_count, positive_reply_rate, leads_not_started, leads_in_progress, leads_completed, leads_blocked, all_time_emails_sent, all_time_interested"
      )
      .eq("campaign_id", campaignId)
      .gte("snapshot_date", sinceStr)
      .order("snapshot_date", { ascending: true }),
    supabase
      .from("mailbox_accounts")
      .select(
        "id, email, domain_name, client, lifecycle_status, warmup_health_pct, platform, is_master_inbox, campaign_ids"
      )
      .contains("campaign_ids", [campaignId])
      .order("email", { ascending: true }),
    supabase
      .from("placement_test_results")
      .select("*")
      .eq("smartlead_campaign_id", campaignId)
      .order("test_date", { ascending: false })
      .limit(1),
  ])

  if (historyRes.error) {
    return Response.json({ error: historyRes.error.message }, { status: 500 })
  }
  if (mailboxRes.error) {
    return Response.json({ error: mailboxRes.error.message }, { status: 500 })
  }

  const history: CampaignDetailPoint[] = (historyRes.data ?? []) as CampaignDetailPoint[]
  const mailboxes: CampaignMailbox[] = (mailboxRes.data ?? []).map((a) => ({
    id: a.id,
    email: a.email,
    domain_name: a.domain_name,
    client: a.client,
    lifecycle_status: a.lifecycle_status,
    warmup_health_pct: a.warmup_health_pct,
    platform: a.platform,
    is_master_inbox: a.is_master_inbox,
  }))
  const placement: PlacementTestResult | null =
    placementRes.data && placementRes.data.length > 0
      ? (placementRes.data[0] as PlacementTestResult)
      : null

  return Response.json({ history, mailboxes, placement })
}
