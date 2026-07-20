"use client"

import {
  Area,
  AreaChart,
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
 * Domain Health — the WEAKEST domain each day (not a pool average that hides a
 * dead box) as a colour-descriptive area: green at/above the 97 burn line,
 * red below. A healthy pool draws a green shape pinned near 100 + an explicit
 * "all healthy" banner; the moment one box burns the area dives red below 97.
 * (V2 Phase 7 origin; simplified V3 H1; made colour-descriptive 2026-07-20.)
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

  // Y-axis floor + the fraction of the axis height sitting AT/ABOVE the 97 burn
  // line. The area (stroke + fill) is green in that top band and red below, so
  // "healthy" reads as a green shape at a glance and a dip literally goes red
  // (Omar 2026-07-20). yMin <= 97 always, so the divisor is never zero.
  const dataMin = Math.min(...points.map((p) => p.worst))
  const yMin = Math.max(0, Math.floor(dataMin - 3))
  const greenOffset = Math.min(1, Math.max(0, (100 - BURN_THRESHOLD) / (100 - yMin)))

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

      {/* Weakest domain each day as a filled area whose colour is driven by the
          97 burn line: green at/above it (healthy), red below (needs attention).
          Simplified from the old dual-axis version (unreadable — Omar V3 H1);
          made colour-descriptive per Omar 2026-07-20. Median + at-risk detail
          live in the hovercard. */}
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              {/* Vertical gradient: green above the 97 line, red below */}
              <linearGradient id="domainHealthStroke" x1="0" y1="0" x2="0" y2="1">
                <stop offset={0} stopColor="#10b981" />
                <stop offset={greenOffset} stopColor="#10b981" />
                <stop offset={greenOffset} stopColor="#ef4444" />
                <stop offset={1} stopColor="#ef4444" />
              </linearGradient>
              <linearGradient id="domainHealthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset={0} stopColor="#10b981" stopOpacity={0.3} />
                <stop offset={greenOffset} stopColor="#10b981" stopOpacity={0.1} />
                <stop offset={greenOffset} stopColor="#ef4444" stopOpacity={0.2} />
                <stop offset={1} stopColor="#ef4444" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickFormatter={(val) => format(new Date(`${val}T00:00:00`), "MMM d")}
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[yMin, 100]}
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
            <Area
              type="monotone"
              dataKey="worst"
              name="Weakest domain"
              stroke="url(#domainHealthStroke)"
              strokeWidth={2.5}
              fill="url(#domainHealthFill)"
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
            <Tooltip content={<BandTooltip />} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Weakest domain each day.{" "}
        <span className="font-medium text-emerald-600 dark:text-emerald-400">Green</span>{" "}
        = at or above the 97% burn line (healthy); it turns{" "}
        <span className="font-medium text-rose-600 dark:text-rose-400">red</span>{" "}
        only if a domain dips below. Hover any day for the median + how many
        domains are below 97.
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
