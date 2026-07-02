const TRIGGER_API_BASE = "https://api.trigger.dev"

const TASK_WHITELIST = [
  "refresh-client-analytics",
  "sync-mailbox-inventory",
  "sync-campaign-registry",
  "monitor-mailbox-health",
  "rotate-burnt-domain",
  "drain-and-swap",
  "run-pipeline",
  "check-domain-candidates",
  "place-inboxkit-order-multi",
] as const

export type WhitelistedTask = (typeof TASK_WHITELIST)[number]

function getSecretKey(): string {
  const key = process.env.TRIGGER_SECRET_KEY
  if (!key) {
    throw new Error("TRIGGER_SECRET_KEY not configured")
  }
  return key
}

export function isTriggerConfigured(): boolean {
  return !!process.env.TRIGGER_SECRET_KEY
}

export async function triggerTask(
  taskId: string,
  payload?: Record<string, unknown>
): Promise<{ runId: string }> {
  if (!TASK_WHITELIST.includes(taskId as WhitelistedTask)) {
    throw new Error(
      `Task "${taskId}" is not in the allowed whitelist. Allowed: ${TASK_WHITELIST.join(", ")}`
    )
  }

  const key = getSecretKey()
  const response = await fetch(
    `${TRIGGER_API_BASE}/api/v1/tasks/${encodeURIComponent(taskId)}/trigger`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ payload: payload ?? {} }),
    }
  )

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(
      `Trigger.dev API error (${response.status}): ${text}`
    )
  }

  const data = await response.json()
  return { runId: data.id }
}

export async function getRunStatus(
  runId: string
): Promise<{ status: string; output?: unknown }> {
  const key = getSecretKey()
  const response = await fetch(
    `${TRIGGER_API_BASE}/api/v3/runs/${encodeURIComponent(runId)}`,
    {
      headers: { Authorization: `Bearer ${key}` },
    }
  )

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(
      `Trigger.dev API error (${response.status}): ${text}`
    )
  }

  const data = await response.json()
  return {
    status: data.status,
    output: (data.metadata as Record<string, unknown>) ?? undefined,
  }
}
