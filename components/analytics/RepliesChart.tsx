"use client"

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import { TrendingUp, TrendingDown } from "lucide-react"
import type { DailyPoint } from "@/types/analytics"

interface RepliesChartProps {
  data: DailyPoint[]
}

function formatDayAbbrev(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z")
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  return days[d.getUTCDay()]
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z")
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

export function RepliesChart({ data }: RepliesChartProps) {
  const values = data.map((d) => d.positive_replies_count)

  // Build chart data with rolling 7-day average per point
  const chartData = data.map((d, i) => {
    const windowStart = Math.max(0, i - 6)
    const window = values.slice(windowStart, i + 1)
    const rollingAvg = window.reduce((a, b) => a + b, 0) / window.length

    return {
      date: d.date,
      label: formatDayAbbrev(d.date),
      fullDate: formatFullDate(d.date),
      value: d.positive_replies_count,
      rollingAvg: Math.round(rollingAvg * 10) / 10,
    }
  })

  // Trend: last-7d avg vs prior-7d avg
  const last7 = values.slice(-7)
  const prior7 = values.slice(-14, -7)
  const avgLast7 = last7.length > 0 ? last7.reduce((a, b) => a + b, 0) / last7.length : 0
  const avgPrior7 = prior7.length > 0 ? prior7.reduce((a, b) => a + b, 0) / prior7.length : 0
  const trendUp = avgLast7 >= avgPrior7
  const trendPct =
    avgPrior7 > 0
      ? Math.abs(((avgLast7 - avgPrior7) / avgPrior7) * 100)
      : avgLast7 > 0
        ? 100
        : 0

  return (
    <div>
      {/* Trend badge */}
      <div className="mb-3 flex items-center gap-2">
        {values.some((v) => v > 0) && (
          trendUp ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
              <TrendingUp className="h-3.5 w-3.5" />
              +{trendPct.toFixed(0)}% vs prior week
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
              <TrendingDown className="h-3.5 w-3.5" />
              {trendPct > 0 ? `-${trendPct.toFixed(0)}%` : "0%"} vs prior week
            </span>
          )
        )}
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={48}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                color: "#111827",
                fontSize: 12,
              }}
              labelFormatter={(_label, payload) => {
                if (payload && payload.length > 0) {
                  return (payload[0].payload as { fullDate: string }).fullDate
                }
                return _label as string
              }}
              formatter={(value: number, name: string) => {
                if (name === "rollingAvg") return [value.toFixed(1), "7d avg"]
                return [value.toLocaleString(), "Positive replies"]
              }}
              cursor={{ fill: "rgba(0,0,0,0.03)" }}
            />
            <Bar
              dataKey="value"
              fill="#8b5cf6"
              radius={[3, 3, 0, 0]}
              maxBarSize={32}
              minPointSize={2}
            />
            <Line
              dataKey="rollingAvg"
              type="monotone"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: "#6366f1" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
