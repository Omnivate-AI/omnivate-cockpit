import { createServerClient } from "@/lib/supabase/server"

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
    .from("mailbox_alerts")
    .update({
      status: "dismissed",
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
