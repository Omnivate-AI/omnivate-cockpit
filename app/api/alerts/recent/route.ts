import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from("vw_cockpit_alerts")
    .select(
      "id, alert_type, severity, title, description, client, status, created_at, domain_name"
    )
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const alerts = (data ?? []).map((a) => ({
    id: a.id,
    alert_type: a.alert_type,
    severity: a.severity,
    title: a.title,
    description: a.description,
    client: a.client ?? "",
    created_at: a.created_at,
  }))

  return NextResponse.json(alerts)
}
