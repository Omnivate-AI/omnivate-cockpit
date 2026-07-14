"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { clientLabel } from "@/lib/types"
import type { ComparisonDataPoint } from "@/lib/queries/analytics"

// Match sidebar CLIENT_COLORS with hex values for Recharts
const CLIENT_LINE_COLORS: Record<string, string> = {
  roosterpunk: "#f43f5e",
  gladlane: "#10b981",
  orbitalx: "#3b82f6",
  valda: "#f59e0b",
  pantheon: "#8b5cf6",
  omnivate: "#6366f1",
  cylindo: "#06b6d4",
}

const FALLBACK_LINE_COLORS = [
  "#14b8a6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#0ea5e9",
  "#d946ef",
  "#eab308",
]

function getLineColor(client: string): string {
  if (CLIENT_LINE_COLORS[client]) return CLIENT_LINE_COLORS[client]
  let hash = 0
  for (let i = 0; i < client.length; i++) {
    hash = (hash * 31 + client.charCodeAt(i)) | 0
  }
  return FALLBACK_LINE_COLORS[Math.abs(hash) % FALLBACK_LINE_COLORS.length]
}

interface ComparisonChartProps {
  title: string
  data: ComparisonDataPoint[]
  clients: string[]
  yAxisFormatter?: (val: number) => string
  tooltipFormatter?: (val: number) => string
}

function ComparisonChart({
  title,
  data,
  clients,
  yAxisFormatter = (val) => String(val),
  tooltipFormatter = (val) => String(val),
}: ComparisonChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[220px] items-center justify-center text-muted-foreground text-sm">
            No data available for the selected clients.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[260px]">
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
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                axisLine={false}
                width={50}
                tickFormatter={yAxisFormatter}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="rounded-lg border bg-background px-3 py-2 shadow-md min-w-[160px]">
                      <p className="text-xs text-muted-foreground mb-1.5">
                        {format(new Date(label), "MMM d, yyyy")}
                      </p>
                      {payload.map((entry) => (
                        <div
                          key={entry.dataKey as string}
                          className="flex items-center justify-between gap-4 text-sm"
                        >
                          <span className="flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span>{clientLabel(entry.dataKey as string)}</span>
                          </span>
                          <span className="font-medium tabular-nums">
                            {tooltipFormatter(Number(entry.value))}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                }}
              />
              <Legend
                formatter={(value: string) => (
                  <span className="text-xs">{clientLabel(value)}</span>
                )}
              />
              {clients.map((client) => (
                <Line
                  key={client}
                  type="monotone"
                  dataKey={client}
                  stroke={getLineColor(client)}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

interface ComparisonChartsProps {
  sendVolume: ComparisonDataPoint[]
  replyRate: ComparisonDataPoint[]
  mailboxHealth: ComparisonDataPoint[]
  clients: string[]
}

export function ComparisonCharts({
  sendVolume,
  replyRate,
  mailboxHealth,
  clients,
}: ComparisonChartsProps) {
  return (
    <div className="space-y-6">
      <ComparisonChart
        title="Send Volume (14 days)"
        data={sendVolume}
        clients={clients}
        yAxisFormatter={(val) => val.toLocaleString()}
        tooltipFormatter={(val) => val.toLocaleString()}
      />
      <ComparisonChart
        title="Positive Reply Rate (14 days)"
        data={replyRate}
        clients={clients}
        yAxisFormatter={(val) => `${val}%`}
        tooltipFormatter={(val) => `${val}%`}
      />
      <ComparisonChart
        title="Mailbox Health Average (14 days)"
        data={mailboxHealth}
        clients={clients}
        yAxisFormatter={(val) => `${val}%`}
        tooltipFormatter={(val) => `${val}%`}
      />
    </div>
  )
}
