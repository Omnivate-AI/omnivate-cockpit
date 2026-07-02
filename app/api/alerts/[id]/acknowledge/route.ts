import { createServerClient } from "@/lib/supabase/server"

// sp_infra_alerts has no separate "dismissed" state — a dismissal is a
// resolution with a note saying so.
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

  const { data, error } = await supabase
    .from("sp_infra_alerts")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: "cockpit",
      resolution_note: "Dismissed via dashboard",
    })
    .eq("id", alertId)
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
