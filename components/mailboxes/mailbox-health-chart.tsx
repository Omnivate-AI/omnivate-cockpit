"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"
import { format } from "date-fns"
import type { DomainHealthPoint } from "@/lib/queries/mailboxes"

interface MailboxHealthChartProps {
  data: DomainHealthPoint[]
}

const BURN_THRESHOLD = 97

export function MailboxHealthChart({ data }: MailboxHealthChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-muted-foreground text-sm">
        No health trend data available.
      </div>
    )
  }

  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
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
            domain={[
              (dataMin: number) => Math.max(0, Math.floor(dataMin - 2)),
              100,
            ]}
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(val) => `${val}%`}
          />
          <ReferenceLine
            y={BURN_THRESHOLD}
            stroke="hsl(0, 84%, 60%)"
            strokeDasharray="6 3"
            label={{
              value: "Burn 97%",
              position: "right",
              fill: "hsl(0, 84%, 60%)",
              fontSize: 10,
            }}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const health = Number(payload[0].value)
              return (
                <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                  <p className="text-xs text-muted-foreground mb-1">
                    {format(new Date(label), "MMM d, yyyy")}
                  </p>
                  <p className="text-sm font-medium tabular-nums">
                    Health: {health.toFixed(1)}%
                  </p>
                </div>
              )
            }}
          />
          <Line
            type="monotone"
            dataKey="avgHealth"
            stroke="hsl(217, 91%, 60%)"
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
