import { NextRequest } from "next/server"

/**
 * GET /api/smartlead/campaign-stats?campaign_id=XXX
 * Fetches real-time campaign analytics from the Smartlead API.
 */
export async function GET(request: NextRequest) {
  const campaignId = request.nextUrl.searchParams.get("campaign_id")
  if (!campaignId || isNaN(Number(campaignId))) {
    return Response.json({ error: "campaign_id is required" }, { status: 400 })
  }

  const apiKey = process.env.SMARTLEAD_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: "SMARTLEAD_API_KEY not configured" },
      { status: 500 }
    )
  }

  try {
    const res = await fetch(
      `https://server.smartlead.ai/api/v1/campaigns/${campaignId}/analytics?api_key=${apiKey}`,
      { method: "GET", headers: { Accept: "application/json" } }
    )

    if (!res.ok) {
      const text = await res.text()
      return Response.json(
        { error: `Smartlead API error: ${text}` },
        { status: res.status }
      )
    }

    const data = await res.json()

    // Smartlead analytics response may be wrapped in {data: ...} or be the object directly
    const stats = data?.data ?? data

    return Response.json({
      campaign_id: Number(campaignId),
      total_leads: stats.total_leads ?? stats.totalLeads ?? 0,
      emails_sent: stats.emails_sent ?? stats.emailsSent ?? 0,
      emails_opened: stats.emails_opened ?? stats.emailsOpened ?? 0,
      replies: stats.replies ?? stats.totalReplies ?? 0,
      positive_replies: stats.positive_replies ?? stats.positiveReplies ?? 0,
      bounced: stats.bounced ?? stats.totalBounced ?? 0,
      unsubscribed: stats.unsubscribed ?? stats.totalUnsubscribed ?? 0,
      open_rate: stats.open_rate ?? stats.openRate ?? null,
      reply_rate: stats.reply_rate ?? stats.replyRate ?? null,
      bounce_rate: stats.bounce_rate ?? stats.bounceRate ?? null,
      fetched_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error("Failed to fetch Smartlead campaign stats:", err)
    return Response.json(
      { error: "Failed to fetch campaign stats" },
      { status: 500 }
    )
  }
}
