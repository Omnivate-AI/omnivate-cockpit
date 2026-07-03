import { CalendarClock, AlertTriangle, Radio } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * The standard per-section freshness label (SHELL-4).
 *
 * Three modes, one vocabulary across the whole app:
 *   facts — "Data as of Tue 1 Jul"        (daily/lifetime facts from the morning sync)
 *   sync  — "Synced Tue 1 Jul, 07:43 UTC" (mirror tables refreshed by the sync)
 *   db    — "Live view"                   (sections reading current DB state directly)
 *
 * Pass `liveAt` to append "· live to 15:36 UTC" where a section also shows
 * intraday webhook data. Purely presentational and deterministic (all times
 * rendered in UTC), so it is safe in both server and client components.
 */
export interface DataAsOfProps {
  mode?: "facts" | "sync" | "db"
  /** As-of date of the daily facts (YYYY-MM-DD). */
  factDate?: string | null
  /** Last successful sync timestamp (ISO) for mode="sync". */
  syncedAt?: string | null
  /** Latest live webhook event (ISO); appends "live to HH:mm UTC". */
  liveAt?: string | null
  /** Overrides the leading words (e.g. "Latest placement test"). */
  prefix?: string
  /** Show the amber overdue pill when data lags expectations. */
  warnWhenStale?: boolean
  className?: string
}

/** Format a YYYY-MM-DD date as "Tue 1 Jul" (UTC, deterministic). */
function fmtFactDate(date: string): string {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number)
  if (!y || !m || !d) return date
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

/** Format an ISO timestamp as "Tue 1 Jul, 07:43 UTC" (deterministic). */
function fmtSyncTime(iso: string): string {
  return `${fmtFactDate(iso)}, ${iso.slice(11, 16)} UTC`
}

/**
 * The daily facts cover the last business day (UTC): weekends produce no
 * sends by design, so on Sat/Sun/Mon the expected as-of date is Friday.
 * The morning sync lands ~07:43 UTC, so expectations shift back one day
 * until 09:00 UTC — facts aren't "overdue" before the sync's window.
 */
export function expectedFactDate(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() - 9 * 3_600_000)
  const d = new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate()
    )
  )
  const day = d.getUTCDay() // 0 Sun … 6 Sat
  const back = day === 0 ? 2 : day === 1 ? 3 : 1
  d.setUTCDate(d.getUTCDate() - back)
  return d.toISOString().slice(0, 10)
}

const SYNC_OVERDUE_HOURS = 26

export function DataAsOf({
  mode = "facts",
  factDate,
  syncedAt,
  liveAt,
  prefix,
  warnWhenStale = true,
  className,
}: DataAsOfProps) {
  let body: React.ReactNode = null
  let overdue = false

  if (mode === "db") {
    body = (
      <>
        <Radio className="h-3 w-3 shrink-0" aria-hidden />
        {prefix ?? "Live view"}
        <span className="hidden sm:inline">— reads current database state</span>
      </>
    )
  } else if (mode === "sync") {
    if (!syncedAt) return null
    overdue =
      warnWhenStale &&
      Date.now() - new Date(syncedAt).getTime() >
        SYNC_OVERDUE_HOURS * 3_600_000
    body = (
      <>
        <CalendarClock className="h-3 w-3 shrink-0" aria-hidden />
        {prefix ?? "Synced"} {fmtSyncTime(syncedAt)}
      </>
    )
  } else {
    if (!factDate) return null
    overdue = warnWhenStale && factDate.slice(0, 10) < expectedFactDate()
    body = (
      <>
        <CalendarClock className="h-3 w-3 shrink-0" aria-hidden />
        {prefix ?? "Data as of"} {fmtFactDate(factDate)}
      </>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground",
        className
      )}
    >
      <span className="inline-flex items-center gap-1.5">{body}</span>
      {liveAt && (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden>·</span>
          <span className="relative flex h-1.5 w-1.5" aria-hidden>
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          live to {liveAt.slice(11, 16)} UTC
        </span>
      )}
      {overdue && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3" aria-hidden />
          Sync overdue
        </span>
      )}
    </span>
  )
}
