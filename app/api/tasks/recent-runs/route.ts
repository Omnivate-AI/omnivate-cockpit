import { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export interface RecentRun {
  taskId: string
  status: string
  finishedAt: string | null
  startedAt: string | null
}

/**
 * GET /api/tasks/recent-runs
 *
 * Post-migration this reports the smartlead-perf plugin's daily sync runs
 * from sp_sync_runs — the actual freshness signal for the sp_* data the app
 * reads. (It used to poll Trigger.dev for legacy sync tasks.)
 */
export async function GET(_request: NextRequest) {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from("sp_sync_runs")
    .select("id, started_at, finished_at, status")
    .order("started_at", { ascending: false })
    .limit(4)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const runs: RecentRun[] = (data ?? []).map((r) => ({
    taskId: `smartlead-perf-sync #${r.id}`,
    status: (r.status ?? "unknown").toLowerCase(),
    finishedAt: r.finished_at ?? null,
    startedAt: r.started_at ?? null,
  }))

  return Response.json({ runs })
}
