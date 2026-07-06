import { createServerClient } from "@/lib/supabase/server"

// vw_cockpit_alerts exposes cockpit_alerts ids offset by 1e9 so both
// sources can share one numeric id space (migration 008).
const COCKPIT_ALERT_ID_OFFSET = 1_000_000_000

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const alertId = parseInt(id, 10)

  if (isNaN(alertId)) {
    return Response.json({ error: "Invalid alert ID" }, { status: 400 })
  }

  let notes: string | undefined
  try {
    const body = await request.json()
    notes = body.notes
  } catch {
    // No body is fine
  }

  const supabase = createServerClient()

  const isCockpit = alertId >= COCKPIT_ALERT_ID_OFFSET
  const { data, error } = await supabase
    .from(isCockpit ? "cockpit_alerts" : "sp_infra_alerts")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: "cockpit",
      resolution_note: notes || "Resolved via dashboard",
    })
    .eq("id", isCockpit ? alertId - COCKPIT_ALERT_ID_OFFSET : alertId)
    .select("id")
    .single()

  if (error || !data) {
    return Response.json(
      { error: error?.message ?? "Alert not found" },
      { status: error ? 500 : 404 }
    )
  }

  return Response.json({ success: true, id: data.id })
}
