"use client"

import { useState, useMemo } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import type { HealthTrendPoint } from "@/lib/queries"

interface HealthTrendChartProps {
  data: HealthTrendPoint[]
  burnThreshold: number
}

const RANGE_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const

// Distinct colors for domain lines (client-aware palette)
const LINE_COLORS = [
  "hsl(217, 91%, 60%)",  // blue
  "hsl(142, 76%, 36%)",  // emerald
  "hsl(263, 70%, 50%)",  // violet
  "hsl(25, 95%, 53%)",   // orange
  "hsl(199, 89%, 48%)",  // sky
  "hsl(347, 77%, 50%)",  // rose
  "hsl(47, 96%, 53%)",   // yellow
  "hsl(173, 80%, 40%)",  // teal
  "hsl(280, 68%, 60%)",  // purple
  "hsl(12, 76%, 61%)",   // coral
  "hsl(160, 60%, 45%)",  // green
  "hsl(330, 80%, 60%)",  // pink
  "hsl(200, 70%, 55%)",  // light blue
  "hsl(35, 90%, 50%)",   // amber
  "hsl(250, 60%, 55%)",  // indigo
]

export function HealthTrendChart({ data, burnThreshold }: HealthTrendChartProps) {
  const [range, setRange] = useState(30)

  const { chartData, domainNames, yMin } = useMemo(() => {
    if (data.length === 0) {
      return { chartData: [], domainNames: [], yMin: 80 }
    }

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - range)

    const filtered = data.filter(
      (d) => new Date(d.snapshot_date) >= cutoff
    )

    // Get unique domain names
    const allDomains = [...new Set(filtered.map((d) => d.domain_name))]

    // If too many domains (>15), pick the 15 with the most health change recently
    let selectedDomains = allDomains
    if (allDomains.length > 15) {
      const domainVariance = allDomains.map((name) => {
        const points = filtered
          .filter((d) => d.domain_name === name)
          .map((d) => d.avg_health_pct)
          .filter((v): v is number => v != null)
        if (points.length < 2) return { name, change: 0 }
        const change = Math.abs(points[points.length - 1] - points[0])
        return { name, change }
      })
      domainVariance.sort((a, b) => b.change - a.change)
      selectedDomains = domainVariance.slice(0, 15).map((d) => d.name)
    }

    // Pivot data: each date becomes a row with domain_name as columns
    const dateMap = new Map<string, Record<string, number | null>>()
    for (const point of filtered) {
      if (!selectedDomains.includes(point.domain_name)) continue
      if (!dateMap.has(point.snapshot_date)) {
        dateMap.set(point.snapshot_date, {})
      }
      dateMap.get(point.snapshot_date)![point.domain_name] = point.avg_health_pct
    }

    const dates = [...dateMap.keys()].sort()
    const pivoted = dates.map((date) => ({
      date,
      ...dateMap.get(date),
    }))

    // Compute Y-axis min
    const allValues = filtered
      .filter((d) => selectedDomains.includes(d.domain_name))
      .map((d) => d.avg_health_pct)
      .filter((v): v is number => v != null)
    const minVal = allValues.length > 0 ? Math.min(...allValues) : 80
    const computedYMin = Math.max(0, Math.floor(minVal / 5) * 5 - 5)

    return {
      chartData: pivoted,
      domainNames: selectedDomains,
      yMin: computedYMin,
    }
  }, [data, range])

  if (data.length === 0) {
    return (
      <div className="flex h-[350px] items-center justify-center text-muted-foreground text-sm">
        No health data available yet. Data will appear after the daily health check.
      </div>
    )
  }

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

      <div className="h-[350px]">
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
              domain={[yMin, 100]}
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
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 shadow-md max-w-xs">
                    <p className="text-xs text-muted-foreground mb-1">
                      {format(new Date(label), "MMM d, yyyy")}
                    </p>
                    <div className="space-y-0.5">
                      {payload.map((entry) => (
                        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
                          <span
                            className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="truncate text-muted-foreground">{entry.dataKey}</span>
                          <span className="ml-auto font-medium tabular-nums">
                            {entry.value != null ? `${Number(entry.value).toFixed(1)}%` : "N/A"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              iconType="circle"
              iconSize={8}
            />
            {domainNames.map((name, i) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
