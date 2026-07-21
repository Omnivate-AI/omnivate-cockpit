"use client"

import { useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { COMPARE_METRICS } from "@/lib/compare-metrics"

/**
 * V4 E1 — the parameter picker. Same chip pattern as the client selector;
 * writes ?metrics= (comma keys). No selection param = all six selected.
 */
export function MetricSelector({ selected }: { selected: string[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const toggle = useCallback(
    (key: string) => {
      const current = new Set(selected)
      if (current.has(key)) {
        if (current.size === 1) return // keep at least one parameter
        current.delete(key)
      } else {
        current.add(key)
      }
      const params = new URLSearchParams(searchParams.toString())
      // Store explicitly; all-selected is the no-param default.
      if (current.size === COMPARE_METRICS.length) {
        params.delete("metrics")
      } else {
        params.set(
          "metrics",
          COMPARE_METRICS.map((m) => m.key)
            .filter((k) => current.has(k))
            .join(",")
        )
      }
      router.replace(`/compare?${params.toString()}`)
    },
    [selected, searchParams, router]
  )

  return (
    <div className="flex flex-wrap gap-2">
      {COMPARE_METRICS.map((m) => {
        const isSelected = selected.includes(m.key)
        return (
          <button
            key={m.key}
            onClick={() => toggle(m.key)}
            aria-pressed={isSelected}
            title={m.help}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm transition-colors",
              isSelected
                ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                : "border-border bg-background text-muted-foreground hover:bg-stone-50 dark:hover:bg-accent/50"
            )}
          >
            {m.label}
            {isSelected && <span className="ml-1.5 text-xs text-indigo-500">&#10003;</span>}
          </button>
        )
      })}
    </div>
  )
}
