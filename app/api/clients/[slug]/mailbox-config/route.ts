import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

interface ConfigUpdate {
  min_daily_send_volume?: number | null
  reserve_target_pct?: number
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const body = (await req.json()) as ConfigUpdate

  const update: ConfigUpdate = {}
  if (body.min_daily_send_volume !== undefined) {
    if (body.min_daily_send_volume !== null) {
      if (typeof body.min_daily_send_volume !== "number" || body.min_daily_send_volume < 0) {
        return NextResponse.json({ error: "Invalid min_daily_send_volume" }, { status: 400 })
      }
    }
    update.min_daily_send_volume = body.min_daily_send_volume
  }
  if (body.reserve_target_pct !== undefined) {
    if (typeof body.reserve_target_pct !== "number" || body.reserve_target_pct < 0 || body.reserve_target_pct > 2) {
      return NextResponse.json({ error: "Invalid reserve_target_pct (0-2)" }, { status: 400 })
    }
    update.reserve_target_pct = body.reserve_target_pct
  }

  const supabase = createServerClient()
  const { error } = await supabase
    .from("mailbox_clients")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("slug", slug)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
