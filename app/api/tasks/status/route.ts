import { NextRequest } from "next/server"
import { getRunStatus, isTriggerConfigured } from "@/lib/trigger-client"

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("runId")
  if (!runId) {
    return Response.json(
      { error: "runId query parameter is required" },
      { status: 400 }
    )
  }

  if (!isTriggerConfigured()) {
    return Response.json(
      { error: "TRIGGER_SECRET_KEY not configured" },
      { status: 500 }
    )
  }

  try {
    const { status, output } = await getRunStatus(runId)
    return Response.json({ status, output: output ?? null })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 502 }
    )
  }
}
