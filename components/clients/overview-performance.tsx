"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bar,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  BarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { format } from "date-fns"
import { Mail, ThumbsUp, MessageCircle, Percent, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricCard, type MetricCardTrend } from "@/components/shared/metric-card"
import { DateRangePicker } from "@/components/clients/date-range-picker"
import { getTargetForDate, type ClientConfig, type DailyTargets } from "@/types/analytics"
import type { PerformanceHistoryPoint } from "@/lib/queries/analytics"

/**
 * V2 Phase 5 — the client Overview performance suite (Omar's 07-13 graph
 * overhaul). ONE range selection (This Week / This Month / All Time / custom
 * from–to) drives the KPI cards AND the confirmed three-chart set:
 *
 *   1. Sends vs Target — daily bars against the weekday-aware target line
 *   2. Reply Rate trend + change — the rate line with its change over the
 *      period explicit, hovercard shows that day's sends / replies / rate
 *   3. Positive Replies — the count and only the count (Interested +
 *      human-action-required)
 *
 * It replaces the old "Sends — Last 7 Days", "Sends & Reply Rate — 14 Days"
 * and "Replies — 30 Days" cards (three charts, three different hardcoded
 * windows, overlapping stories). Everything filters client-side from ONE
 * server fetch, so range switches are instant (Phase 4 spirit).
 */

type TimeRange = "week" | "month" | "all" | "custom"

export interface CustomRange {
  from: string
  to?: string
}

interface OverviewPerformanceProps {
  history: PerformanceHistoryPoint[]
  config: ClientConfig
  customRange?: CustomRange
}

const RANGES: { key: Exclude<TimeRange, "custom">; label: string }[] = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
]

const SEND_FILL = "#6366f1" // indigo — matches the prior send charts
const BELOW_TARGET_FILL = "#ef4444" // red — under that day's target
const WEEKEND_FILL = "#d1d5db" // gray — weekend sends (no target)
const TARGET_STROKE = "#f59e0b" // amber target line
const RATE_STROKE = "#10b981" // emerald rate line
const POSITIVE_FILL = "#10b981" // emerald positive bars

function windowFor(
  range: TimeRange,
  custom?: CustomRange
): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (range === "custom" && custom) {
    const start = new Date(`${custom.from}T00:00:00`)
    const toDay = custom.to ? new Date(`${custom.to}T00:00:00`) : today
    const end = new Date(toDay)
    end.setDate(end.getDate() + 1) // end exclusive
    const len = end.getTime() - start.getTime()
    return { start, end, prevStart: new Date(start.getTime() - len), prevEnd: start }
  }
  if (range === "week" || range === "month") {
    const days = range === "week" ? 7 : 30
    const start = new Date(today)
    start.setDate(start.getDate() - days)
    const prevStart = new Date(start)
    prevStart.setDate(prevStart.getDate() - days)
    return { start, end: tomorrow, prevStart, prevEnd: start }
  }
  // all time — no previous period
  return { start: new Date(0), end: tomorrow, prevStart: new Date(0), prevEnd: new Date(0) }
}

function sumPoints(points: PerformanceHistoryPoint[]) {
  let sent = 0
  let positive = 0
  let total = 0
  for (const p of points) {
    sent += p.emailsSent
    positive += p.positiveReplies
    total += p.totalReplies
  }
  return { sent, positive, total }
}

function computeTrend(current: number, previous: number): MetricCardTrend | undefined {
  if (previous === 0) return undefined
  const pctChange = ((current - previous) / previous) * 100
  const absChange = Math.abs(pctChange)
  if (absChange < 1) return { direction: "flat", value: "No change" }
  return {
    direction: pctChange > 0 ? "up" : "down",
    value: `${absChange.toFixed(0)}% vs prior`,
  }
}

function isWeekend(dateStr: string): boolean {
  const day = new Date(`${dateStr}T00:00:00`).getDay()
  return day === 0 || day === 6
}

export function OverviewPerformance({ history, config, customRange }: OverviewPerformanceProps) {
  const [range, setRange] = useState<TimeRange>(customRange ? "custom" : "week")

  // A newly applied ?from/?to takes over the selection; clearing falls back
  const customKey = customRange ? `${customRange.from}:${customRange.to ?? ""}` : null
  useEffect(() => {
    setRange(customKey ? "custom" : "week")
  }, [customKey])

  const targets = (config.daily_targets as DailyTargets | null) ?? null
  const baseTarget = config.daily_email_target ?? 0

  const { points, prevPoints, chartData } = useMemo(() => {
    const { start, end, prevStart, prevEnd } = windowFor(range, customRange)
    const inWindow = (p: PerformanceHistoryPoint, s: Date, e: Date) => {
      const d = new Date(`${p.date}T00:00:00`)
      return d >= s && d < e
    }
    const points = history
      .filter((p) => inWindow(p, start, end))
      .sort((a, b) => a.date.localeCompare(b.date))
    const prevPoints = history.filter((p) => inWindow(p, prevStart, prevEnd))
    const chartData = points.map((p) => {
      const target = getTargetForDate(p.date, baseTarget, targets)
      return {
        date: p.date,
        sent: p.emailsSent,
        target,
        positive: p.positiveReplies,
        totalReplies: p.totalReplies,
        rate: p.emailsSent > 0 ? (p.totalReplies / p.emailsSent) * 100 : null,
      }
    })
    return { points, prevPoints, chartData }
  }, [history, range, customRange, baseTarget, targets])

  const current = sumPoints(points)
  const previous = range !== "all" ? sumPoints(prevPoints) : null

  const currentRate = current.sent > 0 ? (current.positive / current.sent) * 100 : 0
  const previousRate = previous && previous.sent > 0 ? (previous.positive / previous.sent) * 100 : 0

  // Reply-rate chart headline: period average TOTAL-reply rate + change vs
  // the preceding equal-length period, in percentage points (explicit, per
  // the requirement "its change over the period made explicit")
  const avgRate = current.sent > 0 ? (current.total / current.sent) * 100 : null
  const prevAvgRate = previous && previous.sent > 0 ? (previous.total / previous.sent) * 100 : null
  const rateDelta = avgRate !== null && prevAvgRate !== null ? avgRate - prevAvgRate : null

  const customLabel = customRange
    ? `${customRange.from} → ${customRange.to ?? "today"}`
    : null
  const rangeLabel =
    range === "custom" ? customLabel ?? "Custom" : RANGES.find((r) => r.key === range)?.label ?? ""

  return (
    <div className="space-y-4">
      {/* Toggle bar: presets + custom from–to picker (shared by KPIs AND charts) */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
          {RANGES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              aria-pressed={range === key}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                range === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
          {customRange && (
            <button
              onClick={() => setRange("custom")}
              aria-pressed={range === "custom"}
              title={`Custom range ${customLabel}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                range === "custom"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Custom
            </button>
          )}
        </div>
        <DateRangePicker from={customRange?.from} to={customRange?.to} />
      </div>
      {range === "custom" && customLabel && (
        <p className="text-xs text-muted-foreground -mt-2">
          Showing {customLabel} (vs the preceding period of equal length)
        </p>
      )}

      {/* KPI cards for the selected window */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Positive Replies"
          value={current.positive.toLocaleString()}
          icon={ThumbsUp}
          valueColor="text-emerald-600"
          trend={previous ? computeTrend(current.positive, previous.positive) : undefined}
        />
        <MetricCard
          title="Total Replies"
          value={current.total.toLocaleString()}
          icon={MessageCircle}
          trend={previous ? computeTrend(current.total, previous.total) : undefined}
        />
        <MetricCard
          title="Sent"
          value={current.sent.toLocaleString()}
          icon={Mail}
          trend={previous ? computeTrend(current.sent, previous.sent) : undefined}
        />
        <MetricCard
          title="Positive Reply Rate"
          value={currentRate > 0 ? `${currentRate.toFixed(2)}%` : "0%"}
          icon={Percent}
          trend={previous ? computeTrend(currentRate, previousRate) : undefined}
        />
      </div>

      {/* Chart 1 — Sends vs Target */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            Sends vs Target — {rangeLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => format(new Date(`${v}T00:00:00`), "MMM d")}
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
                    width={46}
                  />
                  <Tooltip content={<SendsTooltip />} />
                  <Bar dataKey="sent" name="Sent" radius={[3, 3, 0, 0]} animationDuration={600}>
                    {chartData.map((d) => (
                      <Cell
                        key={d.date}
                        fill={
                          isWeekend(d.date)
                            ? WEEKEND_FILL
                            : d.target > 0 && d.sent < d.target
                              ? BELOW_TARGET_FILL
                              : SEND_FILL
                        }
                      />
                    ))}
                  </Bar>
                  {/* Weekday-aware target line (steps with the daily_targets JSON) */}
                  <Line
                    type="stepAfter"
                    dataKey="target"
                    name="Target"
                    stroke={TARGET_STROKE}
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            Red bar = under that day&apos;s target · gray = weekend · dashed line = daily target
          </p>
        </CardContent>
      </Card>

      {/* Chart 2 — Reply Rate trend + change */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base font-medium">
              Reply Rate Trend — {rangeLabel}
            </CardTitle>
            {avgRate !== null && (
              <span className="inline-flex items-center gap-1.5 text-sm tabular-nums">
                <span className="font-semibold">{avgRate.toFixed(2)}%</span>
                <span className="text-xs text-muted-foreground">period avg</span>
                {rateDelta !== null && <RateDeltaChip delta={rateDelta} />}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => format(new Date(`${v}T00:00:00`), "MMM d")}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                    width={46}
                  />
                  <Tooltip content={<RateTooltip />} />
                  {avgRate !== null && (
                    <ReferenceLine
                      y={avgRate}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="4 4"
                      strokeOpacity={0.5}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="rate"
                    name="Reply rate"
                    stroke={RATE_STROKE}
                    strokeWidth={2}
                    connectNulls
                    dot={false}
                    activeDot={{ r: 4 }}
                    animationDuration={600}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            Total replies ÷ sends per day · days with no sends are bridged · dashed = period average
          </p>
        </CardContent>
      </Card>

      {/* Chart 3 — Positive Replies (the count, and only the count) */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base font-medium">
              Positive Replies — {rangeLabel}
            </CardTitle>
            <span className="text-sm tabular-nums">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {current.positive.toLocaleString()}
              </span>{" "}
              <span className="text-xs text-muted-foreground">in period</span>
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => format(new Date(`${v}T00:00:00`), "MMM d")}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Tooltip content={<PositiveTooltip />} />
                  <Bar
                    dataKey="positive"
                    name="Positive replies"
                    fill={POSITIVE_FILL}
                    radius={[3, 3, 0, 0]}
                    animationDuration={600}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            Interested + human-action-required (current Smartlead category)
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
      No data in the selected range.
    </div>
  )
}

function RateDeltaChip({ delta }: { delta: number }) {
  const abs = Math.abs(delta)
  if (abs < 0.05) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> flat vs prior
      </span>
    )
  }
  const up = delta > 0
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        up
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
          : "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
      }`}
      title="Change in the period-average rate vs the preceding period of equal length"
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : "−"}
      {abs.toFixed(2)}pp vs prior
    </span>
  )
}

/* --- Tooltips (the hovercard: that day's sends, replies and rate) --- */

interface TooltipPayloadEntry {
  payload?: {
    date: string
    sent: number
    target: number
    positive: number
    totalReplies: number
    rate: number | null
  }
}

function dayLabel(date: string) {
  return format(new Date(`${date}T00:00:00`), "EEE, MMM d")
}

function HovercardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md space-y-0.5">
      {children}
    </div>
  )
}

function SendsTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadEntry[] }) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  return (
    <HovercardShell>
      <p className="font-medium">{dayLabel(d.date)}</p>
      <p>
        Sent <span className="font-semibold tabular-nums">{d.sent.toLocaleString()}</span>
        {d.target > 0 && (
          <span className="text-muted-foreground"> / target {d.target.toLocaleString()}</span>
        )}
      </p>
      {d.target > 0 && (
        <p className={d.sent >= d.target ? "text-emerald-600" : "text-rose-600"}>
          {d.sent >= d.target ? "On target" : `${(d.target - d.sent).toLocaleString()} under`}
        </p>
      )}
    </HovercardShell>
  )
}

function RateTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadEntry[] }) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  return (
    <HovercardShell>
      <p className="font-medium">{dayLabel(d.date)}</p>
      <p>
        Sends <span className="font-semibold tabular-nums">{d.sent.toLocaleString()}</span>
      </p>
      <p>
        Replies <span className="font-semibold tabular-nums">{d.totalReplies.toLocaleString()}</span>
      </p>
      <p>
        Rate{" "}
        <span className="font-semibold tabular-nums">
          {d.rate !== null ? `${d.rate.toFixed(2)}%` : "— (no sends)"}
        </span>
      </p>
    </HovercardShell>
  )
}

function PositiveTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadEntry[] }) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  return (
    <HovercardShell>
      <p className="font-medium">{dayLabel(d.date)}</p>
      <p>
        Positive replies{" "}
        <span className="font-semibold tabular-nums text-emerald-600">{d.positive}</span>
      </p>
    </HovercardShell>
  )
}
