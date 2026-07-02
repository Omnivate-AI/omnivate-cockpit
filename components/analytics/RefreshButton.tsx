"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

const POLL_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

interface ProgressMeta {
  phase: number
  label: string
  current?: number
  total?: number
  campaign?: string
}

function getPhaseLabel(seconds: number): string {
  if (seconds <= 15) return "Syncing campaigns..."
  if (seconds <= 60) return "Fetching stats..."
  if (seconds <= 180) return "Computing snapshots..."
  return "Finalising data..."
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

interface RefreshButtonProps {
  onRefreshComplete: () => void
}

export function RefreshButton({ onRefreshComplete }: RefreshButtonProps) {
  const [loading, setLoading] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [liveProgress, setLiveProgress] = useState<ProgressMeta | null>(null)
  const startTimeRef = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Elapsed timer — counts up every second while loading
  useEffect(() => {
    if (loading) {
      setElapsedSeconds(0)
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1)
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setElapsedSeconds(0)
      setLiveProgress(null)
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [loading])

  const handleRefresh = useCallback(async () => {
    setLoading(true)
    startTimeRef.current = Date.now()
    try {
      const triggerRes = await fetch("/api/analytics/refresh", { method: "POST" })
      if (!triggerRes.ok) {
        const body = await triggerRes.json().catch(() => ({}))
        throw new Error(body.error || "Failed to trigger refresh")
      }
      const { runId } = await triggerRes.json()

      // Poll for completion every 3 seconds, with 10-minute timeout
      const poll = async (): Promise<void> => {
        if (Date.now() - startTimeRef.current > POLL_TIMEOUT_MS) {
          throw new Error("Refresh timed out — check Trigger.dev dashboard")
        }

        const statusRes = await fetch(`/api/analytics/refresh?runId=${runId}`)
        if (!statusRes.ok) {
          const body = await statusRes.json().catch(() => ({}))
          throw new Error(body.error || "Failed to poll status")
        }
        const { status, metadata } = await statusRes.json()

        // Update live progress from task metadata
        if (metadata?.progress) {
          setLiveProgress(metadata.progress as ProgressMeta)
        }

        if (status === "COMPLETED") {
          toast.success("Data updated")
          onRefreshComplete()
          return
        }
        if (status === "FAILED" || status === "CANCELED") {
          throw new Error(`Refresh ${status.toLowerCase()}`)
        }
        // Still running — poll again
        await new Promise((r) => setTimeout(r, 3000))
        return poll()
      }

      await poll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed")
    } finally {
      setLoading(false)
    }
  }, [onRefreshComplete])

  if (loading) {
    const phaseLabel = liveProgress?.label ?? getPhaseLabel(elapsedSeconds)
    const hasCampaignProgress =
      liveProgress != null &&
      typeof liveProgress.current === "number" &&
      typeof liveProgress.total === "number" &&
      liveProgress.total > 0
    const progressPct = hasCampaignProgress
      ? Math.round(((liveProgress!.current! - 1) / liveProgress!.total!) * 100)
      : null

    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className="relative min-w-[240px] overflow-hidden border-gray-200 bg-white text-gray-600 disabled:opacity-100 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        {/* Progress bar track */}
        {progressPct !== null && (
          <span
            className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-indigo-500 transition-all duration-1000"
            style={{ width: `${progressPct}%` }}
          />
        )}
        <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
        <span className="flex flex-col items-start leading-tight">
          <span className="text-xs text-gray-700">{phaseLabel}</span>
          <span className="text-[10px] text-gray-400">
            {hasCampaignProgress
              ? `${liveProgress!.current}/${liveProgress!.total} campaigns · ${formatElapsed(elapsedSeconds)}`
              : formatElapsed(elapsedSeconds)}
          </span>
        </span>
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRefresh}
      className="border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      title="Fetches fresh data from Smartlead — takes 6–10 minutes"
    >
      <RefreshCw className="h-4 w-4" />
      Refresh
    </Button>
  )
}
