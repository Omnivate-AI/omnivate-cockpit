import { NextRequest } from "next/server"
import { isTriggerConfigured } from "@/lib/trigger-client"

const TRIGGER_API_BASE = "https://api.trigger.dev"

const SYNC_TASKS = [
  "monitor-mailbox-health",
  "refresh-client-analytics",
  "sync-campaign-registry",
  "sync-mailbox-inventory",
] as const

export interface RecentRun {
  taskId: string
  status: string
  finishedAt: string | null
  startedAt: string | null
}

export async function GET(_request: NextRequest) {
  if (!isTriggerConfigured()) {
    return Response.json(
      { error: "TRIGGER_SECRET_KEY not configured" },
      { status: 500 }
    )
  }

  const key = process.env.TRIGGER_SECRET_KEY!

  try {
    const results = await Promise.all(
      SYNC_TASKS.map(async (taskId): Promise<RecentRun> => {
        try {
          const res = await fetch(
            `${TRIGGER_API_BASE}/api/v3/runs?taskIdentifier=${encodeURIComponent(taskId)}&limit=1`,
            {
              headers: { Authorization: `Bearer ${key}` },
              next: { revalidate: 0 },
            }
          )

          if (!res.ok) {
            return { taskId, status: "unknown", finishedAt: null, startedAt: null }
          }

          const data = await res.json()
          const runs = data.data ?? data.runs ?? []

          if (runs.length === 0) {
            return { taskId, status: "unknown", finishedAt: null, startedAt: null }
          }

          const run = runs[0]
          return {
            taskId,
            status: run.status?.toLowerCase() ?? "unknown",
            finishedAt: run.finishedAt ?? null,
            startedAt: run.startedAt ?? run.createdAt ?? null,
          }
        } catch {
          return { taskId, status: "unknown", finishedAt: null, startedAt: null }
        }
      })
    )

    return Response.json({ runs: results })
  } catch {
    return Response.json(
      { error: "Failed to fetch recent runs" },
      { status: 502 }
    )
  }
}
