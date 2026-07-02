interface TodayLiveStripProps {
  sendsToday: number
  repliesToday: number
  lastEventAt: string | null
  scopeLabel?: string
}

function fmtUtc(ts: string): string {
  return `${new Date(ts).toISOString().slice(11, 16)} UTC`
}

/**
 * Intraday activity from the live webhook capture (smartlead-events Edge
 * Function → sp_send_events / sp_replies). Deliberately visually distinct
 * from the daily stats: this is a live signal, the daily facts remain the
 * source of truth and update on the morning sync.
 */
export function TodayLiveStrip({
  sendsToday,
  repliesToday,
  lastEventAt,
  scopeLabel,
}: TodayLiveStripProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-2.5 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
      <span className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Today, live{scopeLabel ? ` — ${scopeLabel}` : ""}
      </span>
      <span className="tabular-nums">
        <strong>{sendsToday.toLocaleString()}</strong>{" "}
        <span className="text-muted-foreground">emails sent</span>
      </span>
      <span className="tabular-nums">
        <strong>{repliesToday.toLocaleString()}</strong>{" "}
        <span className="text-muted-foreground">replies</span>
      </span>
      {lastEventAt && (
        <span className="text-xs text-muted-foreground">
          last event {fmtUtc(lastEventAt)}
        </span>
      )}
      <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
        webhook capture · daily stats update on the morning sync
      </span>
    </div>
  )
}
