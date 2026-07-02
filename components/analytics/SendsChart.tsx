"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from "recharts"
import type { DailyPoint } from "@/types/analytics"

interface SendsChartProps {
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

function getBarFill(value: number, target: number): string {
  if (target <= 0) return "#10b981" // emerald-500
  if (value >= target) return "#10b981" // emerald-500
  if (value >= target * 0.5) return "#f59e0b" // amber-500
  if (value > 0) return "#ef4444" // red-500
  return "#e5e7eb" // gray-200
}

export function SendsChart({ data, dailyTarget }: SendsChartProps) {
  const chartData = data.map((d) => ({
    date: d.date,
    label: formatDayAbbrev(d.date),
    fullDate: formatFullDate(d.date),
    value: d.emails_sent_count,
  }))

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <YAxis
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            tickFormatter={formatYAxis}
            tickLine={false}
            axisLine={false}
            width={48}
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
            formatter={(value: number) => [
              `${value.toLocaleString()}${dailyTarget > 0 ? ` / ${dailyTarget.toLocaleString()} target` : ""}`,
              "Emails sent",
            ]}
            cursor={{ fill: "rgba(0,0,0,0.03)" }}
          />
          {dailyTarget > 0 && (
            <ReferenceLine
              y={dailyTarget}
              stroke="#d1d5db"
              strokeDasharray="4 4"
              label={{
                value: `Target: ${dailyTarget.toLocaleString()}`,
                position: "right",
                fill: "#9ca3af",
                fontSize: 10,
              }}
            />
          )}
          <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={32} animationDuration={800}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={getBarFill(entry.value, dailyTarget)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
