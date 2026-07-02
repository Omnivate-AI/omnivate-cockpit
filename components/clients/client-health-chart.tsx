"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { format } from "date-fns"

interface ClientHealthChartProps {
  data: { date: string; avgHealth: number }[]
  burnThreshold: number
}

export function ClientHealthChart({
  data,
  burnThreshold,
}: ClientHealthChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">
        No health data available yet.
      </div>
    )
  }

  // Compute Y-axis min
  const minVal = Math.min(...data.map((d) => d.avgHealth))
  const yMin = Math.max(0, Math.floor(minVal / 5) * 5 - 5)

  return (
    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          <defs>
            <linearGradient id="healthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
            </linearGradient>
          </defs>
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
                <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                  <p className="text-xs text-muted-foreground mb-1">
                    {format(new Date(label), "MMM d, yyyy")}
                  </p>
                  <p className="text-sm font-medium tabular-nums">
                    Avg Health: {Number(payload[0].value).toFixed(1)}%
                  </p>
                </div>
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="avgHealth"
            stroke="hsl(217, 91%, 60%)"
            strokeWidth={2}
            fill="url(#healthGradient)"
            connectNulls
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
