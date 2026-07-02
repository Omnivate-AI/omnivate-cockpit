"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { RANGE_OPTIONS, DEFAULT_RANGE } from "@/lib/range-utils"
import type { RangeValue } from "@/lib/range-utils"

// Re-export for backward compatibility
export { parseRangeDays, DEFAULT_RANGE } from "@/lib/range-utils"
export type { RangeValue } from "@/lib/range-utils"

export function TimeRangeFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get("range") ?? DEFAULT_RANGE

  function handleChange(value: RangeValue) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === DEFAULT_RANGE) {
      params.delete("range")
    } else {
      params.set("range", value)
    }
    const qs = params.toString()
    router.push(qs ? `/?${qs}` : "/", { scroll: false })
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
      {RANGE_OPTIONS.map((r) => (
        <button
          key={r.value}
          onClick={() => handleChange(r.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            current === r.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
