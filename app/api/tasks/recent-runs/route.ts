import { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export interface RecentRun {
  taskId: string
  status: string
  finishedAt: string | null
  startedAt: string | null
}

export interface FreshnessPayload {
  lastSyncAt: string | null
  latestFactDate: string | null
  latestSendEventAt: string | null
  latestReplyAt: string | null
}

/**
 * GET /api/tasks/recent-runs
 *
 * Post-migration this reports the smartlead-perf plugin's daily sync runs
 * from sp_sync_runs — the actual freshness signal for the sp_* data the app
 * reads — plus the global freshness row (vw_cockpit_freshness) so the
 * dashboard widget can show facts as-of and live-capture recency in one call.
 */
export async function GET(_request: NextRequest) {
  const supabase = createServerClient()

  const [runsRes, freshnessRes] = await Promise.all([
    supabase
      .from("sp_sync_runs")
      .select("id, started_at, finished_at, status")
      .order("started_at", { ascending: false })
      .limit(4),
    supabase.from("vw_cockpit_freshness").select("*").single(),
  ])

  if (runsRes.error) {
    return Response.json({ error: runsRes.error.message }, { status: 500 })
  }

  const runs: RecentRun[] = (runsRes.data ?? []).map((r) => ({
    taskId: `smartlead-perf-sync #${r.id}`,
    status: (r.status ?? "unknown").toLowerCase(),
    finishedAt: r.finished_at ?? null,
    startedAt: r.started_at ?? null,
  }))

  const freshness: FreshnessPayload = {
    lastSyncAt: freshnessRes.data?.last_sync_at ?? null,
    latestFactDate: freshnessRes.data?.latest_fact_date ?? null,
    latestSendEventAt: freshnessRes.data?.latest_send_event_at ?? null,
    latestReplyAt: freshnessRes.data?.latest_reply_at ?? null,
  }

  return Response.json({ runs, freshness })
}
