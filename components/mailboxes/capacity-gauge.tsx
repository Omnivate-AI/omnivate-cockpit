"use client"

import { Card, CardContent } from "@/components/ui/card"
import { ProgressBar } from "@/components/shared/progress-bar"

interface CapacityGaugeProps {
  totalCapacity: number
  dailySends: number
  activeCount: number
  totalCount: number
  avgHealth: number | null
}

function utilizationColor(pct: number): string {
  if (pct >= 90) return "text-rose-600"
  if (pct >= 70) return "text-amber-600"
  return "text-emerald-600"
}

export function CapacityGauge({
  totalCapacity,
  dailySends,
  activeCount,
  totalCount,
  avgHealth,
}: CapacityGaugeProps) {
  const utilization = totalCapacity > 0 ? (dailySends / totalCapacity) * 100 : 0

  return (
    <Card>
      <CardContent className="px-4 py-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">Sending Capacity</p>
          <span
            className={`text-sm font-bold tabular-nums ${utilizationColor(utilization)}`}
          >
            {Math.round(utilization)}% used
          </span>
        </div>

        <ProgressBar
          value={utilization}
          showValue={false}
          thresholds={{ warning: 70, critical: 90 }}
        />

        <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
          {dailySends.toLocaleString()} / {totalCapacity.toLocaleString()} emails per day
        </p>

        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            Active Mailboxes:{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {activeCount} / {totalCount}
            </span>
          </span>
          <span>
            Avg Health:{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {avgHealth !== null ? `${avgHealth}%` : "N/A"}
            </span>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
