"use client"

import { useMemo } from "react"
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
import { TrendingUp } from "lucide-react"
import type { PlacementTestResult } from "@/lib/queries/campaigns"

interface PlacementTrendChartProps {
  results: PlacementTestResult[]
}

const LINE_COLORS = [
  "hsl(217, 91%, 60%)", // blue
  "hsl(142, 76%, 36%)", // emerald
  "hsl(263, 70%, 50%)", // violet
  "hsl(25, 95%, 53%)",  // orange
  "hsl(199, 89%, 48%)", // sky
  "hsl(347, 77%, 50%)", // rose
  "hsl(47, 96%, 53%)",  // yellow
  "hsl(173, 80%, 40%)", // teal
]

export function PlacementTrendChart({ results }: PlacementTrendChartProps) {
  const { chartData, campaignNames, hasEnoughData, yMin } = useMemo(() => {
    if (results.length === 0) {
      return { chartData: [], campaignNames: [], hasEnoughData: false, yMin: 0 }
    }

    // Filter to last 30 days. Also drop empty result rows (null inbox_pct /
    // zero seeds — an errored or seedless test run exists in the data, e.g.
    // Cylindo Design Studios 2026-07-02): the old `inbox_pct ?? 0` plotted
    // them as a fake dip to 0%.
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const filtered = results.filter(
      (r) =>
        new Date(r.test_date) >= cutoff &&
        r.inbox_pct != null &&
        (r.total_seeds ?? 0) > 0
    )

    if (filtered.length < 2) {
      return { chartData: [], campaignNames: [], hasEnoughData: false, yMin: 0 }
    }

    // Get unique campaign names
    const names = [...new Set(filtered.map((r) => r.campaign_name))]

    // Pivot: each date becomes a row with campaign names as columns
    const dateMap = new Map<string, Record<string, number | null>>()
    for (const r of filtered) {
      const dateKey = r.test_date.split("T")[0]
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, {})
      }
      dateMap.get(dateKey)![r.campaign_name] = r.inbox_pct ?? 0
    }

    const dates = [...dateMap.keys()].sort()
    const pivoted = dates.map((date) => ({
      date,
      ...dateMap.get(date),
    }))

    // Compute Y-axis min
    const allValues = filtered.map((r) => r.inbox_pct ?? 0)
    const minVal = Math.min(...allValues)
    const computedYMin = Math.max(0, Math.floor(minVal / 10) * 10 - 10)

    return {
      chartData: pivoted,
      campaignNames: names,
      hasEnoughData: true,
      yMin: computedYMin,
    }
  }, [results])

  if (!hasEnoughData) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">
          Need 2+ data points to show placement trends.
        </p>
      </div>
    )
  }

  return (
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
            domain={[yMin, 100]}
            tickFormatter={(val) => `${val}%`}
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
            tickLine={false}
            axisLine={false}
            width={45}
          />
          <ReferenceLine
            y={70}
            stroke="hsl(347, 77%, 50%)"
            strokeDasharray="6 3"
            label={{
              value: "70% threshold",
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
                        <span className="truncate text-muted-foreground">
                          {entry.dataKey}
                        </span>
                        <span className="ml-auto font-medium tabular-nums">
                          {entry.value != null
                            ? `${Number(entry.value).toFixed(1)}%`
                            : "N/A"}
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
          {campaignNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls
              animationDuration={800}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
