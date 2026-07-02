import { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

/**
 * POST /api/campaigns/[id]/status — update a campaign's status via Smartlead API.
 * Body: { status: "PAUSED" | "START" }
 * `id` is the smartlead_campaign_id.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const campaignId = Number(id)
  if (isNaN(campaignId)) {
    return Response.json({ error: "Invalid campaign id" }, { status: 400 })
  }

  const body = await request.json()
  const { status } = body as { status?: string }

  if (!status || !["PAUSED", "START"].includes(status)) {
    return Response.json(
      { error: "status must be PAUSED or START" },
      { status: 400 }
    )
  }

  const apiKey = process.env.SMARTLEAD_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: "SMARTLEAD_API_KEY not configured" },
      { status: 500 }
    )
  }

  try {
    const res = await fetch(
      `https://server.smartlead.ai/api/v1/campaigns/${campaignId}/status?api_key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }
    )

    if (!res.ok) {
      const text = await res.text()
      return Response.json(
        { error: `Smartlead API error: ${text}` },
        { status: res.status }
      )
    }

    const data = await res.json()

    // Update campaign_registry is_active to match
    const supabase = createServerClient()
    await supabase
      .from("campaign_registry")
      .update({ is_active: status === "START" })
      .eq("smartlead_campaign_id", campaignId)

    return Response.json({ ok: true, data })
  } catch (err) {
    console.error("Failed to update campaign status:", err)
    return Response.json(
      { error: "Failed to update campaign status" },
      { status: 500 }
    )
  }
}
