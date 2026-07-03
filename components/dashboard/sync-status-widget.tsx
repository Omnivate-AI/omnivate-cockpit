"use client"

import { useState, useEffect, useCallback } from "react"
import {
  CalendarCheck,
  Database,
  MailCheck,
  MessageCircle,
  History,
  RefreshCw,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { expectedFactDate } from "@/components/shared/data-as-of"
import { toast } from "sonner"
import type { LucideIcon } from "lucide-react"

interface RecentRun {
  taskId: string
  status: string
  finishedAt: string | null
  startedAt: string | null
}

interface FreshnessPayload {
  lastSyncAt: string | null
  latestFactDate: string | null
  latestSendEventAt: string | null
  latestReplyAt: string | null
}

const SYNC_OVERDUE_HOURS = 26

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

function fmtFactDate(date: string | null): string {
  if (!date) return "—"
  const [y, m, d] = date.slice(0, 10).split("-").map(Number)
  if (!y || !m || !d) return date
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

type BadgeVariant = "ok" | "failed" | "overdue" | "unknown"

const BADGE_STYLES: Record<BadgeVariant, string> = {
  ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  failed: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  overdue: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  unknown: "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400",
}

function Badge({ label, variant }: { label: string; variant: BadgeVariant }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[variant]}`}
    >
      {label}
    </span>
  )
}

function FreshnessRow({
  icon: Icon,
  label,
  detail,
  badge,
}: {
  icon: LucideIcon
  label: string
  detail: string
  badge?: { label: string; variant: BadgeVariant }
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-none">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
      {badge && <Badge label={badge.label} variant={badge.variant} />}
    </div>
  )
}

/**
 * Data-freshness panel (SHELL-4 / DEF-5). Reports the signals that actually
 * feed this app: the smartlead-perf daily sync (sp_sync_runs → daily facts)
 * and the live webhook capture (sp_send_events / sp_replies). The Refresh
 * button is PORT-1 — it dispatches the perf-sync GitHub Actions workflow;
 * progress shows up here as the new sync run lands and completes.
 */
export function SyncStatusWidget() {
  const [runs, setRuns] = useState<RecentRun[]>([])
  const [freshness, setFreshness] = useState<FreshnessPayload | null>(null)
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [dispatching, setDispatching] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks/recent-runs")
      if (!res.ok) {
        setError(true)
        return
      }
      const data = await res.json()
      setRuns(data.runs ?? [])
      setFreshness(data.freshness ?? null)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60_000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleRefresh = useCallback(async () => {
    if (dispatching) return
    setDispatching(true)
    try {
      const res = await fetch("/api/analytics/refresh", { method: "POST" })
      const data = (await res.json().catch(() => ({}))) as {
        message?: string
        error?: string
      }
      if (res.status === 202) {
        toast.success(data.message ?? "Sync dispatched")
        // Pull the new run into view as soon as it registers
        setTimeout(fetchData, 20_000)
      } else if (res.status === 501) {
        toast.info(data.error ?? "Sync dispatch not configured yet")
      } else {
        toast.error(data.error ?? "Sync dispatch failed")
      }
    } catch {
      toast.error("Sync dispatch failed")
    } finally {
      setDispatching(false)
    }
  }, [dispatching, fetchData])

  const latestRun = runs[0] ?? null
  const syncTime = latestRun?.finishedAt ?? latestRun?.startedAt ?? null
  const syncOverdue =
    syncTime !== null &&
    Date.now() - new Date(syncTime).getTime() >
      SYNC_OVERDUE_HOURS * 3_600_000

  // sp_sync_runs uses "success"/"failed"/"running"
  const syncBadge: { label: string; variant: BadgeVariant } | undefined =
    !latestRun
      ? undefined
      : ["failed", "error"].includes(latestRun.status)
        ? { label: "Failed", variant: "failed" }
        : syncOverdue
          ? { label: "Overdue", variant: "overdue" }
          : ["success", "completed"].includes(latestRun.status)
            ? { label: "Completed", variant: "ok" }
            : { label: latestRun.status, variant: "unknown" }

  const factsBehind =
    freshness?.latestFactDate != null &&
    freshness.latestFactDate < expectedFactDate()

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Data Freshness</CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={dispatching}
            onClick={handleRefresh}
            title="Run the Smartlead → Supabase sync now"
          >
            <RefreshCw
              className={`h-3 w-3 ${dispatching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Daily sync + live webhook capture
        </p>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-muted-foreground">
            Freshness status unavailable — retrying every minute.
          </p>
        ) : !loaded ? (
          <div className="space-y-3 py-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-8 animate-pulse rounded-md bg-muted"
              />
            ))}
          </div>
        ) : (
          <div className="divide-y">
            <FreshnessRow
              icon={Database}
              label="Daily sync"
              detail={
                latestRun
                  ? `${getRelativeTime(syncTime)}`
                  : "No sync runs recorded"
              }
              badge={syncBadge}
            />
            <FreshnessRow
              icon={CalendarCheck}
              label="Facts through"
              detail={fmtFactDate(freshness?.latestFactDate ?? null)}
              badge={
                factsBehind
                  ? { label: "Behind", variant: "overdue" }
                  : undefined
              }
            />
            <FreshnessRow
              icon={MailCheck}
              label="Live send capture"
              detail={getRelativeTime(freshness?.latestSendEventAt ?? null)}
            />
            <FreshnessRow
              icon={MessageCircle}
              label="Live reply capture"
              detail={getRelativeTime(freshness?.latestReplyAt ?? null)}
            />
            {runs.length > 1 && (
              <div className="flex items-start gap-3 py-2">
                <History className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-none">
                    Recent runs
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {runs
                      .slice(1)
                      .map(
                        (r) =>
                          `${getRelativeTime(r.finishedAt ?? r.startedAt)} · ${r.status}`
                      )
                      .join("  —  ")}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
