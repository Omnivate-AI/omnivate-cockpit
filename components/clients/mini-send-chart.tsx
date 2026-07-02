"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"
import { format } from "date-fns"
import type { ClientDailyDataPoint } from "@/lib/queries/analytics"

interface MiniSendChartProps {
  data: ClientDailyDataPoint[]
  dailyTarget: number
}

const BAR_FILL = "hsl(217, 91%, 60%)"

export function MiniSendChart({ data, dailyTarget }: MiniSendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center text-muted-foreground text-sm">
        No send data available yet.
      </div>
    )
  }

  return (
    <div className="h-[180px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
          <XAxis
            dataKey="date"
            tickFormatter={(val) => format(new Date(val), "MMM d")}
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickLine={false}
            axisLine={false}
            width={40}
          />
          {dailyTarget > 0 && (
            <ReferenceLine
              y={dailyTarget}
              stroke="hsl(142, 71%, 45%)"
              strokeDasharray="6 3"
              label={{
                value: `Target`,
                position: "right",
                fill: "hsl(142, 71%, 45%)",
                fontSize: 10,
              }}
            />
          )}
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const sent = Number(payload[0].value)
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
                </div>
              )
            }}
          />
          <Bar dataKey="emailsSent" fill={BAR_FILL} radius={[3, 3, 0, 0]} animationDuration={800} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
