"use client"

import {
  ComposedChart,
  Bar,
  Cell,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"
import { format } from "date-fns"
import type { SendReplyDataPoint } from "@/lib/queries/analytics"

interface SendReplyChartProps {
  data: SendReplyDataPoint[]
  dailyTarget: number
}

const NORMAL_FILL = "#6366f1"
const BELOW_TARGET_FILL = "#ef4444"
const WEEKEND_FILL = "#d1d5db"
const LINE_STROKE = "#10b981"

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr).getDay()
  return day === 0 || day === 6
}

export function SendReplyChart({ data, dailyTarget }: SendReplyChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-muted-foreground text-sm">
        No send/reply data available yet.
      </div>
    )
  }

  const threshold = dailyTarget * 0.8

  const chartData = data

  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
          <XAxis
            dataKey="date"
            tickFormatter={(val) => {
              const label = format(new Date(val), "MMM d")
              return isWeekend(val) ? `${label} W` : label
            }}
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickLine={false}
            axisLine={false}
            width={45}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(val) => `${val}%`}
          />
          {dailyTarget > 0 && (
            <ReferenceLine
              yAxisId="left"
              y={dailyTarget}
              stroke="hsl(142, 71%, 45%)"
              strokeDasharray="6 3"
              label={{
                value: "Target",
                position: "right",
                fill: "hsl(142, 71%, 45%)",
                fontSize: 10,
              }}
            />
          )}
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const sent = Number(payload[0]?.value ?? 0)
              const rate = Number(payload[1]?.value ?? 0)
              const weekend = isWeekend(label)
              if (weekend) {
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
              return (
                <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                  <p className="text-xs text-muted-foreground mb-1">
                    {format(new Date(label), "MMM d, yyyy")}
                  </p>
                  <p className="text-sm font-medium tabular-nums">
                    Sent: {sent.toLocaleString()}
                  </p>
                  {dailyTarget > 0 && (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      Target: {dailyTarget.toLocaleString()}
                    </p>
                  )}
                  <p className="text-sm font-medium tabular-nums text-emerald-600">
                    Reply Rate: {rate.toFixed(1)}%
                  </p>
                </div>
              )
            }}
          />
          <Bar
            yAxisId="left"
            dataKey="emailsSent"
            radius={[3, 3, 0, 0]}
            animationDuration={800}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={index}
                fill={
                  isWeekend(entry.date)
                    ? WEEKEND_FILL
                    : entry.emailsSent < threshold
                      ? BELOW_TARGET_FILL
                      : NORMAL_FILL
                }
              />
            ))}
          </Bar>
          <Line
            yAxisId="right"
            dataKey="replyRate"
            stroke={LINE_STROKE}
            strokeWidth={2}
            dot={{ r: 3, fill: LINE_STROKE }}
            activeDot={{ r: 5 }}
            animationDuration={800}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
