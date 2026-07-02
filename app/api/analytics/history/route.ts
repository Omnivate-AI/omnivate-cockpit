import { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import type { DailyPoint } from "@/types/analytics"

/**
 * GET /api/analytics/history?client=xxx&days=N
 * Returns up to 90 days of DailyPoint history for a single client,
 * from vw_cockpit_daily_client_perf (sp_daily_campaign_facts rollup).
 */
export async function GET(request: NextRequest) {
  const client = request.nextUrl.searchParams.get("client")
  if (!client) {
    return Response.json({ error: "Missing required 'client' parameter" }, { status: 400 })
  }

  const rawDays = request.nextUrl.searchParams.get("days")
  const days = Math.min(Math.max(Number(rawDays) || 14, 1), 90)

  const supabase = createServerClient()

  const { data: rows, error } = await supabase
    .from("vw_cockpit_daily_client_perf")
    .select("*")
    .eq("client", client)
    .order("snapshot_date", { ascending: false })
    .limit(days)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const history: DailyPoint[] = (rows || [])
    .reverse()
    .map((row) => ({
      date: row.snapshot_date,
      emails_sent_count: row.emails_sent_count ?? 0,
      positive_replies_count: row.positive_replies_count ?? 0,
      reply_count: row.reply_count ?? 0,
      bounced: row.bounced ?? 0,
      hitting_target: true,
      total_runway_days: Number(row.campaign_runway_days ?? 0),
    }))

  return Response.json({ client, history })
}
