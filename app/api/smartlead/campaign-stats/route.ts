import { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

/**
 * GET /api/smartlead/campaign-stats?campaign_id=XXX
 *
 * DEF-1 fix: this route used to call the Smartlead REST API live (with the
 * API key in the query string). Same response shape, but the numbers now
 * come from the sp_* read-models — the app never talks to Smartlead.
 */
export async function GET(request: NextRequest) {
  const campaignId = request.nextUrl.searchParams.get("campaign_id")
  if (!campaignId || isNaN(Number(campaignId))) {
    return Response.json({ error: "campaign_id is required" }, { status: 400 })
  }

  const numId = Number(campaignId)
  const supabase = createServerClient()

  const [{ data: campaign }, { data: latestFact }] = await Promise.all([
    supabase
      .from("vw_cockpit_campaigns")
      .select(
        "smartlead_campaign_id, campaign_name, status, all_time_emails_sent, all_time_replies, all_time_interested, total_leads"
      )
      .eq("smartlead_campaign_id", numId)
      .maybeSingle(),
    supabase
      .from("vw_cockpit_campaign_daily")
      .select("snapshot_date, bounced, unsubscribes, opens")
      .eq("campaign_id", numId)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 })
  }

  const emailsSent = campaign.all_time_emails_sent ?? 0
  const replies = campaign.all_time_replies ?? 0

  return Response.json({
    campaign_id: numId,
    total_leads: campaign.total_leads ?? 0,
    emails_sent: emailsSent,
    emails_opened: latestFact?.opens ?? 0,
    replies,
    positive_replies: campaign.all_time_interested ?? 0,
    bounced: latestFact?.bounced ?? 0,
    unsubscribed: latestFact?.unsubscribes ?? 0,
    open_rate: null,
    reply_rate: emailsSent > 0 ? Number(((replies / emailsSent) * 100).toFixed(2)) : null,
    bounce_rate: null,
    fetched_at: new Date().toISOString(),
    source: "sp_campaign_lifetime",
  })
}
