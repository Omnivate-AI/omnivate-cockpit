"use client"

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { format } from "date-fns"
import type { ReplyHistoryPoint } from "@/lib/queries/analytics"

interface RepliesChartProps {
  data: ReplyHistoryPoint[]
  totalInterested: number
}

const POSITIVE_FILL = "#22c55e"
const OTHER_FILL = "#9ca3af"
const CUMULATIVE_STROKE = "#6366f1"

export function RepliesChart({ data, totalInterested }: RepliesChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-muted-foreground text-sm">
        No reply data available yet.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums">
          {totalInterested.toLocaleString()}
        </span>
        <span className="text-sm text-muted-foreground">interested leads total</span>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
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
              yAxisId="left"
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
              tickLine={false}
              axisLine={false}
              width={35}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
              tickLine={false}
              axisLine={false}
              width={45}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const positive = Number(payload[0]?.value ?? 0)
                const other = Number(payload[1]?.value ?? 0)
                const cumulative = Number(payload[2]?.value ?? 0)
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                    <p className="text-xs text-muted-foreground mb-1">
                      {format(new Date(label), "MMM d, yyyy")}
                    </p>
                    <p className="text-sm font-medium tabular-nums text-emerald-600">
                      Interested: {positive}
                    </p>
                    <p className="text-sm font-medium tabular-nums text-gray-500">
                      Other Replies: {other}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums mt-1">
                      Cumulative Interested: {cumulative.toLocaleString()}
                    </p>
                  </div>
                )
              }}
            />
            <Legend
              verticalAlign="top"
              height={30}
              formatter={(value: string) => (
                <span className="text-xs text-muted-foreground">{value}</span>
              )}
            />
            <Bar
              yAxisId="left"
              dataKey="positiveReplies"
              name="Interested"
              fill={POSITIVE_FILL}
              radius={[3, 3, 0, 0]}
              stackId="replies"
              animationDuration={800}
            />
            <Bar
              yAxisId="left"
              dataKey="otherReplies"
              name="Other Replies"
              fill={OTHER_FILL}
              radius={[3, 3, 0, 0]}
              stackId="replies"
              animationDuration={800}
            />
            <Line
              yAxisId="right"
              dataKey="cumulativeInterested"
              name="Cumulative Interested"
              stroke={CUMULATIVE_STROKE}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              animationDuration={800}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
