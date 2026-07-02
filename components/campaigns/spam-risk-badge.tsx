"use client"

import { cn } from "@/lib/utils"
import type { SpamRiskResult } from "@/lib/scoring/spam-risk"

interface SpamRiskBadgeProps {
  risk: SpamRiskResult
}

export function SpamRiskBadge({ risk }: SpamRiskBadgeProps) {
  if (risk.status === "safe") return null

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none whitespace-nowrap",
        risk.status === "danger" &&
          "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
        risk.status === "warning" &&
          "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
      )}
      title={`Spam Risk Score: ${risk.score}/100`}
    >
      {risk.status === "danger" ? "Likely Spam" : "Check Delivery"}
    </span>
  )
}
