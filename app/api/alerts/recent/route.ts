import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from("mailbox_alerts")
    .select(
      "id, alert_type, severity, title, description, client, status, created_at, mailbox_domains(domain_name, client)"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const alerts = (data ?? []).map((a) => {
    const domain = a.mailbox_domains as unknown as {
      domain_name: string
      client: string
    } | null
    return {
      id: a.id,
      alert_type: a.alert_type,
      severity: a.severity,
      title: a.title,
      description: a.description,
      client: domain?.client ?? a.client ?? "",
      created_at: a.created_at,
    }
  })

  return NextResponse.json(alerts)
}
