import { createServerClient } from "@/lib/supabase/server"

// V2 Phase 8 — Acknowledge is now a REAL, VISIBLE state, not a silent resolve.
// It sets acknowledged_at/acknowledged_by and KEEPS status='open', so the
// alert stays in the list (greyed) and is excluded from "needs attention"
// counts — never deleted (answer #8). Resolve (a separate route) is what
// closes an alert with a note.
//
// vw_cockpit_alerts exposes cockpit_alerts ids offset by 1e9 so both sources
// share one numeric id space (migration 008); band on the id to pick the
// source table.
const COCKPIT_ALERT_ID_OFFSET = 1_000_000_000

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const alertId = parseInt(id, 10)

  if (isNaN(alertId)) {
    return Response.json({ error: "Invalid alert ID" }, { status: 400 })
  }

  const supabase = createServerClient()
  const now = new Date().toISOString()

  const isCockpit = alertId >= COCKPIT_ALERT_ID_OFFSET
  const { data, error } = await supabase
    .from(isCockpit ? "cockpit_alerts" : "sp_infra_alerts")
    .update({
      // status stays 'open' — acknowledge does NOT resolve.
      acknowledged_at: now,
      acknowledged_by: "cockpit",
    })
    .eq("id", isCockpit ? alertId - COCKPIT_ALERT_ID_OFFSET : alertId)
    .eq("status", "open") // only ack an open alert; no-op on a resolved one
    .select("id")
    .single()

  if (error || !data) {
    return Response.json(
      { error: error?.message ?? "Alert not found or already resolved" },
      { status: error ? 500 : 404 }
    )
  }

  return Response.json({ success: true, id: data.id, acknowledged_at: now })
}
