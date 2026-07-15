"use client"

import {
  AreaChart,
  Area,
  LineChart,
  Line,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts"
import { HistoryIcon, Hourglass } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LifecycleHistory } from "@/lib/queries/portfolio"

const MIN_DAYS_FOR_TREND = 7
const BURN_THRESHOLD = 97

function fmtDay(date: string): string {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number)
  if (!y || !m || !d) return date
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  })
}

/**
 * V2 Phase 7 — split the old mashed dual-axis chart (4 lifecycle counts + a
 * warmup % all on one plot with two incompatible scales) into TWO readable
 * charts sharing one x-axis:
 *   1. Lifecycle mix over time — stacked areas of the pool's states.
 *   2. Average warmup over time — the (now mailbox-weighted) pool warmup with
 *      the at-risk count and the 97 burn line, so a dip actually reads.
 * The "history building" and empty states are unchanged.
 */
export function LifecycleHistoryCard({
  history,
}: {
  history: LifecycleHistory
}) {
  const { rows, daysCollected, firstSnapshotDate } = history
  const latest = rows[rows.length - 1]

  const chartRows = rows.map((r) => ({
    date: fmtDay(r.snapshot_date),
    Active: r.active,
    Resting: r.resting,
    Warming: r.warming,
    Reserve: r.reserve,
    warmup: r.avg_warmup,
    atRisk: r.at_risk,
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <HistoryIcon className="h-4 w-4 text-muted-foreground" />
          Lifecycle &amp; Health History
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Daily snapshots of the whole pool — lifecycle mix and average warmup,
          on separate scales
        </p>
      </CardHeader>
      <CardContent>
        {daysCollected === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No snapshots yet — the daily snapshot job (09:05 UTC) populates
            this from its first run.
          </p>
        ) : daysCollected < MIN_DAYS_FOR_TREND ? (
          <div className="flex items-start gap-3 py-2">
            <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="text-sm">
              <p className="font-medium">
                History building — {daysCollected} of {MIN_DAYS_FOR_TREND} days
                collected
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Daily snapshots started{" "}
                {firstSnapshotDate ? fmtDay(firstSnapshotDate) : "today"}; the
                trend charts unlock after a week of history.
              </p>
              {latest && (
                <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                  Latest ({fmtDay(latest.snapshot_date)}): {latest.active}{" "}
                  active · {latest.resting} resting · {latest.warming} warming
                  · {latest.reserve} reserve · avg warmup{" "}
                  {latest.avg_warmup ?? "—"}%
                  {latest.at_risk > 0 && (
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      {" "}
                      · {latest.at_risk} at-risk
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Chart 1 — lifecycle mix */}
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Lifecycle mix (mailboxes)
              </p>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartRows} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="Active" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.5} isAnimationActive={false} />
                    <Area type="monotone" dataKey="Resting" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.5} isAnimationActive={false} />
                    <Area type="monotone" dataKey="Warming" stackId="1" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.5} isAnimationActive={false} />
                    <Area type="monotone" dataKey="Reserve" stackId="1" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.4} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2 — average warmup (weighted) + at-risk */}
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Average warmup % (mailbox-weighted) &amp; at-risk count
              </p>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartRows} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      yAxisId="pct"
                      domain={[
                        (m: number) => Math.max(0, Math.floor(m - 3)),
                        100,
                      ]}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis
                      yAxisId="count"
                      orientation="right"
                      allowDecimals={false}
                      domain={[0, (m: number) => Math.max(4, m)]}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={24}
                    />
                    <ReferenceLine yAxisId="pct" y={BURN_THRESHOLD} stroke="hsl(0,84%,60%)" strokeDasharray="6 3" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="count" dataKey="atRisk" name="At-risk" fill="#f59e0b" fillOpacity={0.2} barSize={12} isAnimationActive={false} />
                    <Line yAxisId="pct" type="monotone" dataKey="warmup" name="Avg warmup %" stroke="#6366f1" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
}
