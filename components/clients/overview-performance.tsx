"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bar,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  LineChart,
  BarChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { format } from "date-fns"
import {
  Mail,
  ThumbsUp,
  MessageCircle,
  Percent,
  Send,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricCard, type MetricCardTrend } from "@/components/shared/metric-card"
import { DateRangePicker } from "@/components/clients/date-range-picker"
import { getTargetForDate, type ClientConfig, type DailyTargets } from "@/types/analytics"
import type {
  ClientContactsByRange,
  PerformanceHistoryPoint,
  ProviderMatrixDay,
  RecipientDailyPoint,
  SenderDailyPoint,
} from "@/lib/queries/analytics"
import { formatRatio } from "@/lib/format"
import {
  isWeekend,
  weekendSpans,
  MIN_SENDS_FOR_RATE,
  SEND_CAPTURE_ERA_START,
  fromRecipientDaily,
  fromSenderDaily,
} from "@/lib/chart-utils"
import {
  ProviderMatrixCard,
  ProviderReplyRateChart,
} from "@/components/clients/provider-insights"

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
  /** V5 — PRIMARY-campaigns-only daily history; feeds ONLY the two efficiency
      ratio cards (follow-up/referral sends happen after a positive). When
      absent the ratios fall back to the all-campaign history. */
  primaryHistory?: PerformanceHistoryPoint[]
  config: ClientConfig
  customRange?: CustomRange
  /** V4 A3 — distinct contacts precomputed server-side per range preset
      (a COUNT(DISTINCT lead) can't be derived from the daily history).
      V5: primary campaigns only. */
  contactsByRange?: ClientContactsByRange
  /** V4 C2/C3/C4 — provider daily series + matrix cells (era-floored server
      fetches; the active range filters them client-side like everything else). */
  recipientDaily?: RecipientDailyPoint[]
  senderDaily?: SenderDailyPoint[]
  matrixDaily?: ProviderMatrixDay[]
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
const WEEKEND_BAND = "#94a3b8" // slate — weekend background band (E2)

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

/**
 * Fill the series to CONTINUOUS calendar days between the first and last point
 * (facts skip days with no activity — mostly weekends). Missing days become
 * zero rows so the x-axis has a real column for every weekend, which is what
 * makes the weekend shading (E2) land where the weekends actually are and the
 * gaps read as "we don't send at weekends", not "data missing".
 */
function fillDaily(points: PerformanceHistoryPoint[]): PerformanceHistoryPoint[] {
  if (points.length === 0) return []
  const byDate = new Map(points.map((p) => [p.date, p]))
  const out: PerformanceHistoryPoint[] = []
  const d = new Date(`${points[0].date}T00:00:00`)
  const end = new Date(`${points[points.length - 1].date}T00:00:00`)
  while (d <= end) {
    const ds = format(d, "yyyy-MM-dd")
    out.push(
      byDate.get(ds) ?? { date: ds, emailsSent: 0, positiveReplies: 0, totalReplies: 0 }
    )
    d.setDate(d.getDate() + 1)
  }
  return out
}

export function OverviewPerformance({
  history,
  primaryHistory,
  config,
  customRange,
  contactsByRange,
  recipientDaily,
  senderDaily,
  matrixDaily,
}: OverviewPerformanceProps) {
  const [range, setRange] = useState<TimeRange>(customRange ? "custom" : "week")

  // A newly applied ?from/?to takes over the selection; clearing falls back
  const customKey = customRange ? `${customRange.from}:${customRange.to ?? ""}` : null
  useEffect(() => {
    setRange(customKey ? "custom" : "week")
  }, [customKey])

  const targets = (config.daily_targets as DailyTargets | null) ?? null
  const baseTarget = config.daily_email_target ?? 0

  const { points, prevPoints, chartData, weekends } = useMemo(() => {
    const { start, end, prevStart, prevEnd } = windowFor(range, customRange)
    const inWindow = (p: PerformanceHistoryPoint, s: Date, e: Date) => {
      const d = new Date(`${p.date}T00:00:00`)
      return d >= s && d < e
    }
    const points = history
      .filter((p) => inWindow(p, start, end))
      .sort((a, b) => a.date.localeCompare(b.date))
    const prevPoints = history.filter((p) => inWindow(p, prevStart, prevEnd))
    // Continuous daily series so every weekend has a real column to shade (E2)
    // and the rate line bridges gaps cleanly (E3). Sums below still use the
    // original fact `points`, so the zero-fill can't change any KPI total.
    const filled = fillDaily(points)
    const chartData = filled.map((p) => {
      const target = getTargetForDate(p.date, baseTarget, targets)
      return {
        date: p.date,
        sent: p.emailsSent,
        target,
        positive: p.positiveReplies,
        totalReplies: p.totalReplies,
        // E3: only real send days get a plotted rate; low-volume days (chiefly
        // weekends) are nulled so one stray reply can't spike the whole axis.
        rate:
          p.emailsSent >= MIN_SENDS_FOR_RATE
            ? (p.totalReplies / p.emailsSent) * 100
            : null,
      }
    })
    const weekends = weekendSpans(filled.map((p) => p.date))
    return { points, prevPoints, chartData, weekends }
  }, [history, range, customRange, baseTarget, targets])

  // V4 C2-C4: the provider series follow the SAME active window as everything
  // else on this page (C1 — one range, stated once, no more guessing).
  const provider = useMemo(() => {
    const { start, end } = windowFor(range, customRange)
    const inWin = (dateStr: string) => {
      const d = new Date(`${dateStr}T00:00:00`)
      return d >= start && d < end
    }
    return {
      recipient: fromRecipientDaily((recipientDaily ?? []).filter((p) => inWin(p.date))),
      sender: fromSenderDaily((senderDaily ?? []).filter((p) => inWin(p.date))),
      matrix: (matrixDaily ?? []).filter((c) => inWin(c.day)),
    }
  }, [recipientDaily, senderDaily, matrixDaily, range, customRange])

  const current = sumPoints(points)
  const previous = range !== "all" ? sumPoints(prevPoints) : null

  const currentRate = current.sent > 0 ? (current.positive / current.sent) * 100 : 0
  const previousRate = previous && previous.sent > 0 ? (previous.positive / previous.sent) * 100 : 0

  // V4 A1/A3 — the two efficiency ratios, differentiated (Omar: emailing one
  // person 10 times who then replies = 10:1 emails/positive, 1:1
  // contacts/positive). Contacts come precomputed per preset (COUNT DISTINCT
  // can't be summed client-side).
  // V5 — PRIMARY campaigns only on BOTH sides: follow-up/referral sends are
  // post-positive by nature, and their "positives" are re-engagements of
  // already-won leads. Window-filter the primary history with the same
  // predicate as the main series.
  const primaryCurrent = useMemo(() => {
    if (!primaryHistory) return null
    const { start, end } = windowFor(range, customRange)
    return sumPoints(
      primaryHistory.filter((p) => {
        const d = new Date(`${p.date}T00:00:00`)
        return d >= start && d < end
      })
    )
  }, [primaryHistory, range, customRange])
  const ratioSent = primaryCurrent ? primaryCurrent.sent : current.sent
  const ratioPositives = primaryCurrent ? primaryCurrent.positive : current.positive
  const emailsPerPositive = ratioPositives > 0 ? ratioSent / ratioPositives : null
  const contactsInRange = contactsByRange ? contactsByRange[range] : null
  const contactsPerPositive =
    contactsInRange != null && ratioPositives > 0
      ? contactsInRange / ratioPositives
      : null
  // Send-event capture began 2026-06-03 — an "All Time" contacts count can't
  // reach further back, so the label says so instead of implying all-time.
  const contactsWindowNote =
    range === "all" && contactsByRange
      ? ` · since ${format(new Date(`${contactsByRange.eraStart}T00:00:00`), "d MMM yyyy")}`
      : ""

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
      {/* Always label the active window (Omar V3 D2 — the old cards read
          "all time, all time" while others said nothing). */}
      <p className="text-xs text-muted-foreground -mt-2">
        Showing {rangeLabel}
        {range !== "all" ? " · vs the preceding period of equal length" : ""}
      </p>

      {/* KPI cards for the selected window */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        {/* V4 A1/A3 — the two efficiency ratios at client level. Distinct
            metrics: 10 emails to 1 replier = 10:1 emails/positive but 1:1
            contacts/positive. Do not merge or drop as redundant. */}
        <MetricCard
          title="Contacts per Positive Reply"
          value={formatRatio(contactsPerPositive)}
          icon={Users}
          subtitle={`People ÷ positive reply · primary campaigns${contactsWindowNote}`}
        />
        <MetricCard
          title="Emails per Positive Reply"
          value={formatRatio(emailsPerPositive)}
          icon={Send}
          subtitle="Emails ÷ positive reply · primary campaigns"
        />
      </div>

      {/* Chart 1 — Positive Replies (the hero metric; top per Omar V3 E1).
          Value labels make each day's count legible; weekend bands (E2). */}
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
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 18, right: 10, left: 0, bottom: 5 }}>
                  {weekends.map((w) => (
                    <ReferenceArea
                      key={`wk-${w.x1}`}
                      x1={w.x1}
                      x2={w.x2}
                      fill={WEEKEND_BAND}
                      fillOpacity={0.16}
                      stroke="none"
                    />
                  ))}
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
                  >
                    <LabelList
                      dataKey="positive"
                      position="top"
                      formatter={(value: number | string) =>
                        Number(value) > 0 ? value : ""
                      }
                      fill="#059669"
                      fontSize={10}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            Interested + human-action-required · gray band = weekend
          </p>
        </CardContent>
      </Card>

      {/* Chart 2 — Sends vs Target */}
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
                  {weekends.map((w) => (
                    <ReferenceArea
                      key={`wk-${w.x1}`}
                      x1={w.x1}
                      x2={w.x2}
                      fill={WEEKEND_BAND}
                      fillOpacity={0.16}
                      stroke="none"
                    />
                  ))}
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
            Red bar = under that day&apos;s target · gray band = weekend · dashed line = daily target
          </p>
        </CardContent>
      </Card>

      {/* Chart 3 — Reply Rate trend + change (LAST per Omar V3 E3; low-volume
          days omitted so a stray weekend reply can't spike the whole axis) */}
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
                  {weekends.map((w) => (
                    <ReferenceArea
                      key={`wk-${w.x1}`}
                      x1={w.x1}
                      x2={w.x2}
                      fill={WEEKEND_BAND}
                      fillOpacity={0.16}
                      stroke="none"
                    />
                  ))}
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
            Total replies ÷ sends on real send days · low-volume days (e.g. weekends,
            gray band) omitted so a stray reply can&apos;t skew the trend · dashed = period average
          </p>
        </CardContent>
      </Card>

      {/* V4 C2 — reply rate INTO each recipient inbox provider (the split
          Omar was reading when he spotted Microsoft ≈ nothing vs Google). */}
      {recipientDaily && (
        <ProviderReplyRateChart
          points={provider.recipient}
          title="Reply Rate by Recipient Provider"
          sideNote="Recipient side — the inboxes we send INTO, classified by live MX records"
          rangeLabel={rangeLabel}
          windowNote={`data from ${format(
            new Date(`${SEND_CAPTURE_ERA_START}T00:00:00`),
            "d MMM yyyy"
          )} (send-event capture)`}
        />
      )}

      {/* V4 C3 — the same chart keyed by the SENDING mailbox pool. */}
      {senderDaily && (
        <ProviderReplyRateChart
          points={provider.sender}
          title="Reply Rate by Sender Mailbox Provider"
          sideNote="Sender side — OUR mailbox pools (Google / Microsoft / Other-SMTP)"
          rangeLabel={rangeLabel}
        />
      )}

      {/* V4 C4 — the 3×3 sender × recipient matrix. */}
      {matrixDaily && (
        <ProviderMatrixCard
          cells={provider.matrix}
          rangeLabel={rangeLabel}
          eraStart={SEND_CAPTURE_ERA_START}
        />
      )}
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
