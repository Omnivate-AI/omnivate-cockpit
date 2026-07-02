import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

// Order history now reads sp_orders (email-infra plugin's audited order log).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from("sp_orders")
    .select(
      "id, status, domain_count, mailbox_count, total_cost_usd, placed_at, completed_at, monitoring_task_run_id, selected_domains"
    )
    .eq("client", slug)
    .order("placed_at", { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
