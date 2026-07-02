import { createServerClient } from "@/lib/supabase/server"

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

  const { data, error } = await supabase
    .from("sp_infra_alerts")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: "cockpit",
      resolution_note: notes || "Resolved via dashboard",
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
