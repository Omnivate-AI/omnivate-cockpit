"use client"

import { useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { format } from "date-fns"
import type { HealthSnapshot } from "@/lib/types"
import { Button } from "@/components/ui/button"

interface HealthChartProps {
  snapshots: HealthSnapshot[]
  burnThreshold: number
}

const RANGE_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const

export function HealthChart({ snapshots, burnThreshold }: HealthChartProps) {
  const [range, setRange] = useState(30)

  if (snapshots.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground text-sm">
        No health data available yet. Data will appear after the daily health
        check.
      </div>
    )
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - range)

  const filtered = snapshots.filter(
    (s) => new Date(s.snapshot_date) >= cutoff
  )

  const chartData = filtered.map((s) => ({
    date: s.snapshot_date,
    health: s.avg_health_pct,
  }))

  // Dynamic Y-axis: show meaningful variation
  const values = chartData
    .map((d) => d.health)
    .filter((v): v is number => v != null)
  const minVal = values.length > 0 ? Math.min(...values) : 80
  const yMin = Math.max(0, Math.floor(minVal / 5) * 5 - 5)
  const yMax = 100

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        {RANGE_OPTIONS.map((opt) => (
          <Button
            key={opt.days}
            variant={range === opt.days ? "default" : "outline"}
            size="sm"
            onClick={() => setRange(opt.days)}
            className="h-7 px-3 text-xs"
          >
            {opt.label}
          </Button>
        ))}
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <XAxis
              dataKey="date"
              tickFormatter={(val) => format(new Date(val), "MMM d")}
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[yMin, yMax]}
              tickFormatter={(val) => `${val}%`}
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
              tickLine={false}
              axisLine={false}
              width={45}
            />
            <ReferenceLine
              y={burnThreshold}
              stroke="hsl(347, 77%, 50%)"
              strokeDasharray="6 3"
              label={{
                value: "Burn Threshold",
                position: "right",
                fill: "hsl(347, 77%, 50%)",
                fontSize: 11,
              }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0]
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(d.payload.date), "MMM d, yyyy")}
                    </p>
                    <p className="text-sm font-medium tabular-nums">
                      {d.value != null
                        ? `${Number(d.value).toFixed(1)}%`
                        : "N/A"}
                    </p>
                  </div>
                )
              }}
            />
            <Line
              type="monotone"
              dataKey="health"
              stroke="hsl(217, 91%, 60%)"
              strokeWidth={2}
              dot={{ r: 3, fill: "hsl(217, 91%, 60%)" }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
