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
import { HistoryIcon, Hourglass } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LifecycleHistory } from "@/lib/queries/portfolio"

const MIN_DAYS_FOR_TREND = 7

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
 * HEALTH-4: lifecycle + health trend from the daily mailbox snapshots
 * (sp_mailbox_daily, written by the FND-3 pg_cron job since 2026-07-03).
 * Shows an explicit "history building" state until enough snapshots exist —
 * per the requirement, never a broken or misleading chart.
 */
export function LifecycleHistoryCard({
  history,
}: {
  history: LifecycleHistory
}) {
  const { rows, daysCollected, firstSnapshotDate } = history
  const latest = rows[rows.length - 1]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <HistoryIcon className="h-4 w-4 text-muted-foreground" />
          Lifecycle &amp; Health History
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Daily snapshots of the whole pool — lifecycle mix, average warmup,
          at-risk count
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
                trend chart unlocks after a week of history.
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
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={rows.map((r) => ({
                  date: fmtDay(r.snapshot_date),
                  Active: r.active,
                  Resting: r.resting,
                  Warming: r.warming,
                  "At-risk": r.at_risk,
                  "Avg warmup %": r.avg_warmup,
                }))}
                margin={{ top: 4, right: 8, bottom: 0, left: -16 }}
              >
                <XAxis dataKey="date" fontSize={11} tickLine={false} />
                <YAxis yAxisId="count" fontSize={11} tickLine={false} />
                <YAxis
                  yAxisId="pct"
                  orientation="right"
                  domain={[90, 100]}
                  fontSize={11}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="count" type="monotone" dataKey="Active" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line yAxisId="count" type="monotone" dataKey="Resting" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                <Line yAxisId="count" type="monotone" dataKey="Warming" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                <Line yAxisId="count" type="monotone" dataKey="At-risk" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line yAxisId="pct" type="monotone" dataKey="Avg warmup %" stroke="#6366f1" strokeWidth={2} strokeDasharray="4 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
