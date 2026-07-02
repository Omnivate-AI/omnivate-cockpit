import { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import type { DailyPoint } from "@/types/analytics"

/**
 * GET /api/analytics/history?client=xxx&days=N
 * Returns up to 90 days of DailyPoint history for a single client.
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
    .from("analytics_snapshots")
    .select("*")
    .eq("client", client)
    .order("snapshot_date", { ascending: true })
    .limit(days)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const history: DailyPoint[] = (rows || []).map((row) => ({
    date: row.snapshot_date,
    emails_sent_count: row.emails_sent_count ?? 0,
    positive_replies_count: row.positive_replies_count ?? 0,
    reply_count: 0,
    bounced: 0,
    hitting_target: row.hitting_target ?? false,
    total_runway_days: Number(row.total_runway_days ?? 0),
  }))

  return Response.json({ client, history })
}
