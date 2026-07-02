import { NextRequest, NextResponse } from "next/server"
import { triggerTask } from "@/lib/trigger-client"

export async function POST(request: NextRequest) {
  const secret = request.headers.get("X-Webhook-Secret")
  const expected = process.env.SMARTLEAD_WEBHOOK_SECRET

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { runId } = await triggerTask("sync-campaign-registry")
    return NextResponse.json({ ok: true, runId }, { status: 200 })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to trigger sync"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
