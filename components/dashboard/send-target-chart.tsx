"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { format } from "date-fns"
import type { DailySendDataPoint } from "@/lib/queries/analytics"

interface SendTargetChartProps {
  data: DailySendDataPoint[]
}

const NORMAL_FILL = "hsl(217, 91%, 60%)"
const BELOW_TARGET_FILL = "hsl(347, 77%, 50%)"
const WEEKEND_FILL = "#d1d5db"
const TARGET_THRESHOLD = 0.8

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr).getDay()
  return day === 0 || day === 6
}

export function SendTargetChart({ data }: SendTargetChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">
        No send data available yet.
      </div>
    )
  }

  // Check if all targets are the same (use single reference line) or per-day varies
  const targets = data.map((d) => d.target)
  const allSame = targets.every((t) => t === targets[0])
  const staticTarget = allSame ? targets[0] : 0

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          <XAxis
            dataKey="date"
            tickFormatter={(val) => {
              const label = format(new Date(val), "MMM d")
              return isWeekend(val) ? `${label} W` : label
            }}
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
            tickLine={false}
            axisLine={false}
            width={50}
            tickFormatter={(val) => val.toLocaleString()}
          />
          {staticTarget > 0 && (
            <ReferenceLine
              y={staticTarget}
              stroke="hsl(142, 71%, 45%)"
              strokeDasharray="6 3"
              label={{
                value: `Target: ${staticTarget.toLocaleString()}`,
                position: "right",
                fill: "hsl(142, 71%, 45%)",
                fontSize: 11,
              }}
            />
          )}
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const sent = Number(payload[0].value)
              const point = data.find((d) => d.date === label)
              const dayTarget = point?.target ?? 0
              const weekend = isWeekend(label)
              if (weekend && dayTarget === 0) {
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                    <p className="text-xs text-muted-foreground mb-1">
                      {format(new Date(label), "MMM d, yyyy")}
                    </p>
                    <p className="text-sm font-medium text-muted-foreground">
                      Weekend — no sending expected
                    </p>
                    {sent > 0 && (
                      <p className="text-xs tabular-nums">
                        Sent: {sent.toLocaleString()}
                      </p>
                    )}
                  </div>
                )
              }
              const pct = dayTarget > 0 ? ((sent / dayTarget) * 100).toFixed(0) : "N/A"
              return (
                <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                  <p className="text-xs text-muted-foreground mb-1">
                    {format(new Date(label), "MMM d, yyyy")}
                  </p>
                  <p className="text-sm font-medium tabular-nums">
                    Sent: {sent.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Target: {dayTarget.toLocaleString()} ({pct}%)
                  </p>
                </div>
              )
            }}
          />
          <Bar dataKey="totalSent" radius={[4, 4, 0, 0]} animationDuration={800}>
            {data.map((entry, index) => {
              const dayTarget = entry.target
              const weekend = isWeekend(entry.date) && dayTarget === 0
              return (
                <Cell
                  key={index}
                  fill={
                    weekend
                      ? WEEKEND_FILL
                      : dayTarget > 0 && entry.totalSent < dayTarget * TARGET_THRESHOLD
                        ? BELOW_TARGET_FILL
                        : NORMAL_FILL
                  }
                />
              )
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
