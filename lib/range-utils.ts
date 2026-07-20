/** Shared range parsing — importable from both Server and Client components */

// Label "Yesterday" not "Today": the cockpit reads the last COMPLETE business
// day from the daily sync — there is no live-today view. Calling the 1-day
// view "Today" made the headline numbers read as if they were live (Omar V3
// A1). The KPI cards additionally stamp the actual date (e.g. "Fri, 10 Jul")
// for the Mon/weekend case where "yesterday" would be a Friday.
export const RANGE_OPTIONS = [
  { label: "Yesterday", value: "1d", days: 1 },
  { label: "7 Days", value: "7d", days: 7 },
  { label: "14 Days", value: "14d", days: 14 },
  { label: "30 Days", value: "30d", days: 30 },
] as const

export type RangeValue = (typeof RANGE_OPTIONS)[number]["value"]

// Default view = yesterday (the single latest business day), not the 7-day
// roll-up (Omar V3 A5). Because this is the DEFAULT, navigating back to the
// Command Center with no ?range param lands here every time.
export const DEFAULT_RANGE: RangeValue = "1d"

export function parseRangeDays(range: string | undefined): number {
  const match = RANGE_OPTIONS.find((r) => r.value === range)
  return match?.days ?? 1
}

/**
 * The most recent weekday (Mon–Fri) on or before the given date. Weekend fact
 * rows DO exist (near-zero stray weekend sends/replies), so the "Yesterday" /
 * latest-business-day anchor must skip them (Omar 2026-07-20): checked on a
 * Monday it resolves to the previous Friday, not Sunday. Sat→Fri, Sun→Fri;
 * a weekday returns itself. UTC to match the UTC snapshot_date dates.
 */
export function toBusinessDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  let dow = d.getUTCDay() // 0=Sun … 6=Sat
  while (dow === 0 || dow === 6) {
    d.setUTCDate(d.getUTCDate() - 1)
    dow = d.getUTCDay()
  }
  return d.toISOString().split("T")[0]
}
