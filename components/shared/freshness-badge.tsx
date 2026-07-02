"use client"

import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { Clock } from "lucide-react"

interface FreshnessBadgeProps {
  date: string | null | undefined
  className?: string
}

function getFreshnessLevel(date: string): "fresh" | "stale" | "very-stale" {
  const ageMs = Date.now() - new Date(date).getTime()
  const ageHours = ageMs / (1000 * 60 * 60)
  if (ageHours > 168) return "very-stale" // 7 days
  if (ageHours > 48) return "stale"
  return "fresh"
}

export function FreshnessBadge({ date, className }: FreshnessBadgeProps) {
  if (!date) return null

  const level = getFreshnessLevel(date)
  const relative = formatDistanceToNow(new Date(date), { addSuffix: true })

  if (level === "very-stale") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-400",
          className
        )}
      >
        <Clock className="h-3 w-3" />
        Very Stale &middot; {relative}
      </span>
    )
  }

  if (level === "stale") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
          className
        )}
      >
        <Clock className="h-3 w-3" />
        Stale &middot; {relative}
      </span>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground",
        className
      )}
    >
      <Clock className="h-3 w-3" />
      {relative}
    </span>
  )
}
