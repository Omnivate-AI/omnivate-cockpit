"use client"

import { cn } from "@/lib/utils"
import { RANGE_OPTIONS } from "@/lib/range-utils"
import { useRangeTransition } from "./range-transition"

// Re-export for backward compatibility
export { parseRangeDays, DEFAULT_RANGE } from "@/lib/range-utils"
export type { RangeValue } from "@/lib/range-utils"

/**
 * Command Center range switch. Pressed state + pending veil come from
 * RangeTransitionProvider (V2 Phase 4) — the click responds the same frame
 * instead of after the server round-trip (measured 1.5-1.8s before).
 */
export function TimeRangeFilter({ oneDayLabel }: { oneDayLabel?: string } = {}) {
  const { displayRange, navigate } = useRangeTransition()

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
      {RANGE_OPTIONS.map((r) => (
        <button
          key={r.value}
          onClick={() => navigate(r.value)}
          aria-pressed={displayRange === r.value}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            displayRange === r.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {/* The single-day button shows the actual business day (e.g. "Friday"
              on a Monday) instead of a misleading "Yesterday" — Omar 2026-07-20 */}
          {r.value === "1d" && oneDayLabel ? oneDayLabel : r.label}
        </button>
      ))}
    </div>
  )
}
