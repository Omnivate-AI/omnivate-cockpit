"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { toast } from "sonner"

const POLL_INTERVAL_MS = 5_000
const TERMINAL_STATES = ["COMPLETED", "FAILED", "CANCELED"]

export function useTaskTrigger() {
  const [isRunning, setIsRunning] = useState(false)
  const [status, setStatus] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const runIdRef = useRef<string | null>(null)

  const clearPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => clearPolling()
  }, [clearPolling])

  const pollStatus = useCallback(
    (runId: string) => {
      intervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(
            `/api/tasks/status?runId=${encodeURIComponent(runId)}`
          )
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(
              (data as { error?: string }).error || `Status check failed (${res.status})`
            )
          }

          const data = (await res.json()) as { status: string; output?: unknown }
          setStatus(data.status)

          if (TERMINAL_STATES.includes(data.status)) {
            clearPolling()
            setIsRunning(false)
            runIdRef.current = null

            if (data.status === "COMPLETED") {
              toast.success("Task completed successfully")
            } else if (data.status === "FAILED") {
              toast.error("Task failed")
            } else {
              toast.info("Task was canceled")
            }
          }
        } catch (err) {
          clearPolling()
          setIsRunning(false)
          runIdRef.current = null
          const msg = err instanceof Error ? err.message : "Failed to poll status"
          setError(msg)
          toast.error(msg)
        }
      }, POLL_INTERVAL_MS)
    },
    [clearPolling]
  )

  const trigger = useCallback(
    async (taskId: string, payload?: Record<string, unknown>) => {
      if (isRunning) return

      setIsRunning(true)
      setStatus("")
      setError(null)

      try {
        const res = await fetch("/api/tasks/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, payload }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(
            (data as { error?: string }).error || `Trigger failed (${res.status})`
          )
        }

        const { runId } = (await res.json()) as { runId: string }
        runIdRef.current = runId
        setStatus("TRIGGERED")
        toast.info(`Task "${taskId}" triggered`)
        pollStatus(runId)
      } catch (err) {
        setIsRunning(false)
        const msg = err instanceof Error ? err.message : "Failed to trigger task"
        setError(msg)
        toast.error(msg)
      }
    },
    [isRunning, pollStatus]
  )

  return { trigger, isRunning, status, error }
}
