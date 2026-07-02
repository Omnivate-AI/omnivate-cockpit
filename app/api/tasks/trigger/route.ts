import { NextRequest } from "next/server"
import { triggerTask, isTriggerConfigured } from "@/lib/trigger-client"

export async function POST(request: NextRequest) {
  if (!isTriggerConfigured()) {
    return Response.json(
      { error: "TRIGGER_SECRET_KEY not configured" },
      { status: 500 }
    )
  }

  let body: { taskId?: string; payload?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { taskId, payload } = body
  if (!taskId || typeof taskId !== "string") {
    return Response.json(
      { error: "taskId is required and must be a string" },
      { status: 400 }
    )
  }

  try {
    const { runId } = await triggerTask(taskId, payload)
    return Response.json({ runId })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    const status = message.includes("not in the allowed whitelist") ? 400 : 502
    return Response.json({ error: message }, { status })
  }
}
