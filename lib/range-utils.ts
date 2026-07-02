/** Shared range parsing — importable from both Server and Client components */

export const RANGE_OPTIONS = [
  { label: "Today", value: "1d", days: 1 },
  { label: "7 Days", value: "7d", days: 7 },
  { label: "14 Days", value: "14d", days: 14 },
  { label: "30 Days", value: "30d", days: 30 },
] as const

export type RangeValue = (typeof RANGE_OPTIONS)[number]["value"]

export const DEFAULT_RANGE: RangeValue = "7d"

export function parseRangeDays(range: string | undefined): number {
  const match = RANGE_OPTIONS.find((r) => r.value === range)
  return match?.days ?? 7
}
