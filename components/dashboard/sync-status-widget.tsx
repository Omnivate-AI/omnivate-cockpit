"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Play, RefreshCw, Activity, BarChart3, Users, Mail, PlayCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useTaskTrigger } from "@/hooks/use-task-trigger"
import { toast } from "sonner"
import type { LucideIcon } from "lucide-react"

interface RecentRun {
  taskId: string
  status: string
  finishedAt: string | null
  startedAt: string | null
}

interface SyncTask {
  taskId: string
  label: string
  icon: LucideIcon
}

const SYNC_TASKS: SyncTask[] = [
  { taskId: "monitor-mailbox-health", label: "Health Monitor", icon: Activity },
  { taskId: "refresh-client-analytics", label: "Analytics Refresh", icon: BarChart3 },
  { taskId: "sync-campaign-registry", label: "Campaign Sync", icon: Users },
  { taskId: "sync-mailbox-inventory", label: "Mailbox Sync", icon: Mail },
]

const SYNC_ALL_SEQUENCE = [
  "sync-mailbox-inventory",
  "monitor-mailbox-health",
  "sync-campaign-registry",
  "refresh-client-analytics",
]

const SYNC_ALL_LABELS: Record<string, string> = {
  "sync-mailbox-inventory": "Syncing mailboxes",
  "monitor-mailbox-health": "Monitoring health",
  "sync-campaign-registry": "Syncing campaigns",
  "refresh-client-analytics": "Refreshing analytics",
}

const POLL_MS = 5_000
const TERMINAL = ["COMPLETED", "FAILED", "CANCELED"]

const OVERDUE_HOURS = 26

function getRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never"
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  const date = new Date(dateStr)
  const now = new Date()
  return now.getTime() - date.getTime() > OVERDUE_HOURS * 3_600_000
}

type BadgeVariant = "completed" | "failed" | "overdue" | "unknown"

function getStatusBadge(
  status: string,
  finishedAt: string | null
): { label: string; variant: BadgeVariant } {
  if (status === "completed" && isOverdue(finishedAt)) {
    return { label: "Overdue", variant: "overdue" }
  }
  if (status === "completed") {
    return { label: "Completed", variant: "completed" }
  }
  if (status === "failed") {
    return { label: "Failed", variant: "failed" }
  }
  return { label: "Unknown", variant: "unknown" }
}

const BADGE_STYLES: Record<BadgeVariant, string> = {
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  failed: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  overdue: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  unknown: "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400",
}

function useSyncAll(onComplete: () => void) {
  const [isRunning, setIsRunning] = useState(false)
  const [step, setStep] = useState(0)
  const [stepLabel, setStepLabel] = useState("")
  const abortRef = useRef(false)

  useEffect(() => {
    return () => { abortRef.current = true }
  }, [])

  const pollUntilDone = useCallback(async (runId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const check = async () => {
        if (abortRef.current) { reject(new Error("Aborted")); return }
        try {
          const res = await fetch(`/api/tasks/status?runId=${encodeURIComponent(runId)}`)
          if (!res.ok) throw new Error("Status check failed")
          const data = (await res.json()) as { status: string }
          if (TERMINAL.includes(data.status)) {
            resolve(data.status)
          } else {
            setTimeout(check, POLL_MS)
          }
        } catch (err) {
          reject(err)
        }
      }
      check()
    })
  }, [])

  const run = useCallback(async () => {
    if (isRunning) return
    setIsRunning(true)
    abortRef.current = false

    for (let i = 0; i < SYNC_ALL_SEQUENCE.length; i++) {
      if (abortRef.current) break
      const taskId = SYNC_ALL_SEQUENCE[i]
      setStep(i + 1)
      setStepLabel(SYNC_ALL_LABELS[taskId] ?? taskId)

      try {
        const trigRes = await fetch("/api/tasks/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId }),
        })
        if (!trigRes.ok) {
          const data = await trigRes.json().catch(() => ({}))
          throw new Error((data as { error?: string }).error || "Trigger failed")
        }
        const { runId } = (await trigRes.json()) as { runId: string }
        const finalStatus = await pollUntilDone(runId)
        if (finalStatus === "FAILED") {
          toast.error(`Step ${i + 1}/4 failed: ${SYNC_ALL_LABELS[taskId]}`)
          setIsRunning(false)
          setStep(0)
          setStepLabel("")
          return
        }
        if (finalStatus === "CANCELED") {
          toast.info("Sync canceled")
          setIsRunning(false)
          setStep(0)
          setStepLabel("")
          return
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Sync failed")
        setIsRunning(false)
        setStep(0)
        setStepLabel("")
        return
      }
    }

    setIsRunning(false)
    setStep(0)
    setStepLabel("")
    toast.success("All syncs completed")
    onComplete()
  }, [isRunning, pollUntilDone, onComplete])

  return { run, isRunning, step, stepLabel }
}

function SyncTaskRow({
  task,
  run,
}: {
  task: SyncTask
  run: RecentRun | undefined
}) {
  const { trigger, isRunning } = useTaskTrigger()
  const Icon = task.icon

  const status = run?.status ?? "unknown"
  const lastTime = run?.finishedAt ?? run?.startedAt ?? null
  const badge = getStatusBadge(status, run?.finishedAt ?? null)

  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-none">{task.label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {getRelativeTime(lastTime)}
        </p>
      </div>
      <span
        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[badge.variant]}`}
      >
        {badge.label}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        disabled={isRunning}
        onClick={() => trigger(task.taskId)}
        title={`Run ${task.label}`}
      >
        {isRunning ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  )
}

export function SyncStatusWidget() {
  const [runs, setRuns] = useState<RecentRun[]>([])
  const [error, setError] = useState(false)

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks/recent-runs")
      if (!res.ok) {
        setError(true)
        return
      }
      const data = await res.json()
      setRuns(data.runs ?? [])
      setError(false)
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => {
    fetchRuns()
    const interval = setInterval(fetchRuns, 60_000)
    return () => clearInterval(interval)
  }, [fetchRuns])

  const handleSyncAllComplete = useCallback(() => {
    fetchRuns()
    window.location.reload()
  }, [fetchRuns])

  const syncAll = useSyncAll(handleSyncAllComplete)

  const runMap = new Map(runs.map((r) => [r.taskId, r]))

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Sync Status</CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={syncAll.isRunning}
            onClick={syncAll.run}
          >
            {syncAll.isRunning ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin" />
                Step {syncAll.step}/4
              </>
            ) : (
              <>
                <PlayCircle className="h-3 w-3" />
                Sync All
              </>
            )}
          </Button>
        </div>
        {syncAll.isRunning && syncAll.stepLabel && (
          <p className="mt-1 text-xs text-muted-foreground">
            {syncAll.stepLabel}...
          </p>
        )}
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-muted-foreground">
            Status unavailable
          </p>
        ) : (
          <div className="divide-y">
            {SYNC_TASKS.map((task) => (
              <SyncTaskRow
                key={task.taskId}
                task={task}
                run={runMap.get(task.taskId)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
