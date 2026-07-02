"use client"

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from "recharts"
import type { DailyPoint } from "@/types/analytics"

interface CombinedChartProps {
  data: DailyPoint[]
  dailyTarget: number
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

function formatYAxis(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`
  return String(value)
}

export function CombinedChart({ data, dailyTarget }: CombinedChartProps) {
  const chartData = data.map((d) => ({
    date: d.date,
    label: formatDayAbbrev(d.date),
    fullDate: formatFullDate(d.date),
    sends: d.emails_sent_count,
    replies: d.positive_replies_count,
  }))

  return (
    <div style={{ height: 180 }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            tickFormatter={formatYAxis}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={36}
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
              if (name === "replies") return [value.toLocaleString(), "Positive replies"]
              return [value.toLocaleString(), "Emails sent"]
            }}
            cursor={{ fill: "rgba(0,0,0,0.03)" }}
          />
          <Bar
            yAxisId="left"
            dataKey="sends"
            radius={[3, 3, 0, 0]}
            maxBarSize={32}
          >
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={
                  dailyTarget > 0 && entry.sends >= dailyTarget
                    ? "#f97316" // orange-500 (hitting target)
                    : "#ef4444" // red-500 (below target)
                }
              />
            ))}
          </Bar>
          <Line
            yAxisId="right"
            dataKey="replies"
            type="monotone"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: "#8b5cf6" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
