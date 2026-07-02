import { NextRequest } from "next/server"
import { triggerTask, getRunStatus, isTriggerConfigured } from "@/lib/trigger-client"

/**
 * POST /api/analytics/refresh — trigger the refresh-client-analytics task
 * GET  /api/analytics/refresh?runId=xxx — poll run status
 */

export async function POST() {
  if (!isTriggerConfigured()) {
    return Response.json(
      { error: "TRIGGER_SECRET_KEY not configured" },
      { status: 500 }
    )
  }

  try {
    const { runId } = await triggerTask("refresh-client-analytics")
    return Response.json({ runId })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 502 }
    )
  }
}

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("runId")
  if (!runId) {
    return Response.json({ error: "runId parameter is required" }, { status: 400 })
  }

  if (!isTriggerConfigured()) {
    return Response.json(
      { error: "TRIGGER_SECRET_KEY not configured" },
      { status: 500 }
    )
  }

  try {
    const { status, output } = await getRunStatus(runId)
    return Response.json({
      status,
      metadata: output ?? null,
    })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 502 }
    )
  }
}
