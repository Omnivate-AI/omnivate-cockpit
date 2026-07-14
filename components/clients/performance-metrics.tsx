"use client"

import { useState, useMemo } from "react"
import { Mail, ThumbsUp, MessageCircle, Percent } from "lucide-react"
import { MetricCard, type MetricCardTrend } from "@/components/shared/metric-card"
import type { PerformanceHistoryPoint } from "@/lib/queries/analytics"

type TimeRange = "week" | "month" | "all"

interface PerformanceMetricsProps {
  history: PerformanceHistoryPoint[]
}

function getDateRange(range: TimeRange): { start: Date; prevStart: Date; prevEnd: Date } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

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

export function PerformanceMetrics({ history }: PerformanceMetricsProps) {
  const [range, setRange] = useState<TimeRange>("week")

  const metrics = useMemo(() => {
    const { start, prevStart, prevEnd } = getDateRange(range)

    const current = sumPeriod(history, start)
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

  return (
    <div className="space-y-4">
      {/* Toggle Bar */}
      <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
        {RANGES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setRange(key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              range === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

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
