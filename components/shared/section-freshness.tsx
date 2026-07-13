import { getFreshness } from "@/lib/queries"
import { DataAsOf, type DataAsOfProps } from "@/components/shared/data-as-of"

interface SectionFreshnessProps
  extends Pick<DataAsOfProps, "mode" | "prefix" | "warnWhenStale" | "className"> {
  /** Append "live to HH:mm UTC" from the webhook capture. */
  live?: boolean
  /** In facts mode, append "· synced {time}" from the last daily sync. */
  synced?: boolean
  /** Override the displayed facts date (e.g. a client's own snapshot_date). */
  factDate?: string | null
}

/**
 * Server component: fetches the global freshness row (vw_cockpit_freshness,
 * request-deduped via React cache) and renders the standard DataAsOf label.
 * Drop into any section header — one line, same vocabulary everywhere.
 */
export async function SectionFreshness({
  mode = "facts",
  live = false,
  synced = false,
  factDate,
  prefix,
  warnWhenStale,
  className,
}: SectionFreshnessProps) {
  if (mode === "db") {
    return <DataAsOf mode="db" prefix={prefix} className={className} />
  }

  const freshness = await getFreshness()

  return (
    <DataAsOf
      mode={mode}
      factDate={
        mode === "facts" ? factDate ?? freshness.latestFactDate : undefined
      }
      syncedAt={mode === "sync" || synced ? freshness.lastSyncAt : undefined}
      liveAt={live ? freshness.latestSendEventAt : undefined}
      prefix={prefix}
      warnWhenStale={warnWhenStale}
      className={className}
    />
  )
}
