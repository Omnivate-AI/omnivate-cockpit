"use client"

import { useEffect, useState, useMemo } from "react"
import { Mail, ThumbsUp, MessageCircle, Percent } from "lucide-react"
import { MetricCard, type MetricCardTrend } from "@/components/shared/metric-card"
import { DateRangePicker } from "@/components/clients/date-range-picker"
import type { PerformanceHistoryPoint } from "@/lib/queries/analytics"

type TimeRange = "week" | "month" | "all" | "custom"

export interface CustomRange {
  from: string
  /** Defaults to today when the URL carries only ?from */
  to?: string
}

interface PerformanceMetricsProps {
  history: PerformanceHistoryPoint[]
  /** Applied ?from/?to custom range (V2 Phase 4 date picker) */
  customRange?: CustomRange
}

function getDateRange(
  range: TimeRange,
  custom?: CustomRange
): { start: Date; end?: Date; prevStart: Date; prevEnd: Date } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (range === "custom" && custom) {
    // Inclusive [from, to]; previous period = the equal-length window
    // immediately before it (for the vs-prior trend chips).
    const start = new Date(`${custom.from}T00:00:00`)
    const toDay = custom.to ? new Date(`${custom.to}T00:00:00`) : today
    const end = new Date(toDay)
    end.setDate(end.getDate() + 1) // sumPeriod treats end as exclusive
    const lengthMs = end.getTime() - start.getTime()
    const prevStart = new Date(start.getTime() - lengthMs)
    return { start, end, prevStart, prevEnd: start }
  }

  if (range === "week") {
    // This week = last 7 days, previous week = 7 days before that
    const start = new Date(today)
    start.setDate(start.getDate() - 7)
    const prevStart = new Date(start)
    prevStart.setDate(prevStart.getDate() - 7)
    return { start, prevStart, prevEnd: start }
  }

  if (range === "month") {
    // This month = last 30 days, previous = 30 days before that
    const start = new Date(today)
    start.setDate(start.getDate() - 30)
    const prevStart = new Date(start)
    prevStart.setDate(prevStart.getDate() - 30)
    return { start, prevStart, prevEnd: start }
  }

  // All time — no previous period
  return {
    start: new Date(0),
    prevStart: new Date(0),
    prevEnd: new Date(0),
  }
}

function sumPeriod(
  data: PerformanceHistoryPoint[],
  start: Date,
  end?: Date
): { sent: number; interested: number; totalReplies: number } {
  let sent = 0
  let interested = 0
  let totalReplies = 0

  for (const point of data) {
    const d = new Date(point.date)
    if (d >= start && (!end || d < end)) {
      sent += point.emailsSent
      interested += point.positiveReplies
      totalReplies += point.totalReplies
    }
  }

  return { sent, interested, totalReplies }
}

function computeTrend(current: number, previous: number): MetricCardTrend | undefined {
  if (previous === 0) return undefined
  const pctChange = ((current - previous) / previous) * 100
  const absChange = Math.abs(pctChange)

  if (absChange < 1) {
    return { direction: "flat", value: "No change" }
  }

  return {
    direction: pctChange > 0 ? "up" : "down",
    value: `${absChange.toFixed(0)}% vs prior`,
  }
}

const RANGES: { key: TimeRange; label: string }[] = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
]

export function PerformanceMetrics({ history, customRange }: PerformanceMetricsProps) {
  const [range, setRange] = useState<TimeRange>(customRange ? "custom" : "week")

  // A newly applied ?from/?to takes over the selection; clearing it falls
  // back to This Week. Key on the values so re-applies re-select too.
  const customKey = customRange ? `${customRange.from}:${customRange.to ?? ""}` : null
  useEffect(() => {
    setRange(customKey ? "custom" : "week")
  }, [customKey])

  const metrics = useMemo(() => {
    const { start, end, prevStart, prevEnd } = getDateRange(range, customRange)

    const current = sumPeriod(history, start, end)
    const previous = range !== "all" ? sumPeriod(history, prevStart, prevEnd) : null

    const currentReplyRate = current.sent > 0 ? (current.interested / current.sent) * 100 : 0
    const previousReplyRate = previous && previous.sent > 0
      ? (previous.interested / previous.sent) * 100
      : 0

    return {
      interested: {
        value: current.interested,
        trend: previous ? computeTrend(current.interested, previous.interested) : undefined,
      },
      totalReplies: {
        value: current.totalReplies,
        trend: previous ? computeTrend(current.totalReplies, previous.totalReplies) : undefined,
      },
      sent: {
        value: current.sent,
        trend: previous ? computeTrend(current.sent, previous.sent) : undefined,
      },
      replyRate: {
        value: currentReplyRate,
        trend: previous ? computeTrend(currentReplyRate, previousReplyRate) : undefined,
      },
    }
  }, [history, range])

  const customLabel = customRange
    ? `${customRange.from} → ${customRange.to ?? "today"}`
    : null

  return (
    <div className="space-y-4">
      {/* Toggle Bar: presets + the custom from–to picker (V2 Phase 4) */}
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

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Positive Replies"
          value={metrics.interested.value.toLocaleString()}
          icon={ThumbsUp}
          valueColor="text-emerald-600"
          trend={metrics.interested.trend}
        />
        <MetricCard
          title="Total Replies"
          value={metrics.totalReplies.value.toLocaleString()}
          icon={MessageCircle}
          trend={metrics.totalReplies.trend}
        />
        <MetricCard
          title="Sent"
          value={metrics.sent.value.toLocaleString()}
          icon={Mail}
          trend={metrics.sent.trend}
        />
        <MetricCard
          title="Positive Reply Rate"
          value={metrics.replyRate.value > 0 ? `${metrics.replyRate.value.toFixed(2)}%` : "0%"}
          icon={Percent}
          trend={metrics.replyRate.trend}
        />
      </div>
    </div>
  )
}
