"use client"

import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"
import { format } from "date-fns"
import { ShieldCheck } from "lucide-react"
import type { DomainHealthBands } from "@/lib/queries/mailboxes"

interface MailboxHealthChartProps {
  data: DomainHealthBands
}

const BURN_THRESHOLD = 97

/**
 * V2 Phase 7 — Domain Health as a WORST/AT-RISK band, not a flat pool
 * average. Plots the weakest domain (min) and the p25→median band each day,
 * plus an at-risk-domain count on a secondary axis. A healthy pool no longer
 * draws an uninformative flat-100 line: it shows an explicit "all healthy"
 * banner, and the moment one box burns the worst line dives below the 97 mark
 * (the pool average would have hidden it — measured AP avg 99.2 with a 0.0 box).
 */
export function MailboxHealthChart({ data }: MailboxHealthChartProps) {
  const { points, allHealthy } = data

  if (points.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-muted-foreground text-sm">
        No health trend data available.
      </div>
    )
  }

  const latest = points[points.length - 1]
  const worstNow = latest?.worst ?? 100
  const atRiskNow = latest?.atRisk ?? 0

  return (
    <div className="space-y-2">
      {/* Explicit healthy state — the truth for a pool sitting at 100 */}
      {allHealthy ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          All domains healthy — the weakest stayed at or above the 97 burn line
          for the whole window.
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          <span className="text-muted-foreground">Now:</span>
          <span
            className={
              worstNow < BURN_THRESHOLD
                ? "font-semibold text-rose-600 dark:text-rose-400 tabular-nums"
                : "font-medium tabular-nums"
            }
          >
            weakest domain {worstNow.toFixed(1)}%
          </span>
          {atRiskNow > 0 && (
            <span className="font-medium text-amber-600 dark:text-amber-400 tabular-nums">
              · {atRiskNow} domain{atRiskNow === 1 ? "" : "s"} below 97
            </span>
          )}
        </div>
      )}

      {/* Simplified per Omar V3 H1: just the weakest domain vs the 97 burn
          line — the dual-axis median/p25/at-risk-bar version was unreadable.
          The at-risk count still shows in the summary line above + the
          hovercard; the chart itself now says ONE thing clearly. */}
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <XAxis
              dataKey="date"
              tickFormatter={(val) => format(new Date(`${val}T00:00:00`), "MMM d")}
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[
                (dataMin: number) => Math.max(0, Math.floor(dataMin - 3)),
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
            <Line
              type="monotone"
              dataKey="worst"
              name="Weakest domain"
              stroke="hsl(0, 72%, 51%)"
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
            <Tooltip content={<BandTooltip />} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-muted-foreground">
        The single weakest domain each day vs the 97% burn line. A healthy pool
        keeps it pinned near the top; a dip below 97 means a domain needs attention.
      </p>
    </div>
  )
}

interface BandPayload {
  payload?: {
    date: string
    worst: number
    p25: number
    median: number
    atRisk: number
    domains: number
  }
}

function BandTooltip({ active, payload }: { active?: boolean; payload?: BandPayload[] }) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md space-y-0.5">
      <p className="font-medium">{format(new Date(`${d.date}T00:00:00`), "MMM d, yyyy")}</p>
      <p className={d.worst < BURN_THRESHOLD ? "text-rose-600 dark:text-rose-400" : ""}>
        Weakest domain <span className="font-semibold tabular-nums">{d.worst.toFixed(1)}%</span>
      </p>
      <p className="text-muted-foreground">
        Median <span className="tabular-nums">{d.median.toFixed(1)}%</span> · p25{" "}
        <span className="tabular-nums">{d.p25.toFixed(1)}%</span>
      </p>
      <p className={d.atRisk > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
        {d.atRisk} of {d.domains} domain{d.domains === 1 ? "" : "s"} below 97
      </p>
    </div>
  )
}
