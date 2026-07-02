"use client"

import { cn } from "@/lib/utils"
import type { CampaignHealthResult } from "@/lib/scoring/campaign-health"

const STATUS_STYLES = {
  healthy: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  critical: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
} as const

interface CampaignHealthBadgeProps {
  health: CampaignHealthResult
}

export function CampaignHealthBadge({ health }: CampaignHealthBadgeProps) {
  const breakdownText = health.breakdown
    .map((b) => `${b.label}: ${b.score}/${b.maxScore}`)
    .join("\n")

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
        STATUS_STYLES[health.status]
      )}
      title={`Health Score: ${health.score}/100\n${breakdownText}`}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          health.status === "healthy" && "bg-emerald-500",
          health.status === "warning" && "bg-amber-500",
          health.status === "critical" && "bg-rose-500"
        )}
      />
      {health.score}
    </span>
  )
}
