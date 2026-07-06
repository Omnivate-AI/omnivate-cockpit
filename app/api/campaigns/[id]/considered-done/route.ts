import { createServerClient } from "@/lib/supabase/server"

/**
 * Mark a campaign "done" (or reopen it). [id] here is the sp_campaigns.id
 * (NOT the Smartlead campaign id, which the sibling /status and /detail
 * routes use) — cockpit_campaign_overrides keys on the sp id.
 *
 * considered_done campaigns stop counting toward primary lead runway and
 * the lead-runway alert (vw_cockpit_client_runway, migration 007/008) —
 * the fix for "finished campaigns nagging me daily" (Omar 2026-07-06,
 * Design Studios case).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const campaignId = parseInt(id, 10)

  if (isNaN(campaignId)) {
    return Response.json({ error: "Invalid campaign ID" }, { status: 400 })
  }

  let done: boolean
  try {
    const body = await request.json()
    if (typeof body.done !== "boolean") throw new Error("missing done")
    done = body.done
  } catch {
    return Response.json(
      { error: "Body must be { done: boolean }" },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  const { error } = await supabase.from("cockpit_campaign_overrides").upsert(
    {
      campaign_id: campaignId,
      considered_done: done,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "campaign_id" }
  )

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, campaign_id: campaignId, done })
}
