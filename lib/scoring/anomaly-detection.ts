// Anomaly detection — pure function, no DB queries
// Detects: SEND_DROP, REPLY_RATE_DROP, SEND_BELOW_TARGET

import type { DailyTargets } from "@/types/analytics"
import { getTargetForDate } from "@/types/analytics"

export type AnomalyType =
  | "SEND_DROP"
  | "REPLY_RATE_DROP"
  | "SEND_BELOW_TARGET"

export interface AnomalyDataPoint {
  date: string
  emailsSent: number
  positiveReplies: number
}

export interface AnomalyConfig {
  daily_email_target: number
  daily_targets?: DailyTargets | null
}

export interface Anomaly {
  type: AnomalyType
  severity: "warning" | "critical"
  title: string
  description: string
  date: string
  currentValue: number
  expectedValue: number
}

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr).getDay()
  return day === 0 || day === 6
}

/**
 * Detect anomalies in client send/reply history.
 * Returns max 3 anomalies, sorted by severity (critical first).
 * Expects `history` sorted by date ascending (oldest first).
 * Skips weekends (Saturday/Sunday) for SEND_DROP and SEND_BELOW_TARGET
 * since campaigns don't send on weekends.
 */
export function detectAnomalies(
  history: AnomalyDataPoint[],
  config: AnomalyConfig
): Anomaly[] {
  if (history.length < 2) return []

  const anomalies: Anomaly[] = []

  // 1. SEND_DROP: day-over-day drop > 30% (skip weekends)
  for (let i = history.length - 1; i >= 1; i--) {
    const current = history[i]
    if (isWeekend(current.date)) continue
    const previous = history[i - 1]
    if (isWeekend(previous.date)) continue
    if (previous.emailsSent > 0) {
      const dropPct =
        ((previous.emailsSent - current.emailsSent) /
          previous.emailsSent) *
        100
      if (dropPct > 30) {
        anomalies.push({
          type: "SEND_DROP",
          severity: dropPct > 60 ? "critical" : "warning",
          title: "Send Volume Drop",
          description: `Sends dropped ${Math.round(dropPct)}% from ${previous.emailsSent.toLocaleString()} to ${current.emailsSent.toLocaleString()}`,
          date: current.date,
          currentValue: current.emailsSent,
          expectedValue: previous.emailsSent,
        })
        break // only report the most recent send drop
      }
    }
  }

  // 2. REPLY_RATE_DROP: latest reply rate < 50% of 7-day moving average
  if (history.length >= 3) {
    const windowSize = Math.min(7, history.length - 1)
    const windowSlice = history.slice(
      history.length - 1 - windowSize,
      history.length - 1
    )
    const avgRate = computeAvgReplyRate(windowSlice)
    const latest = history[history.length - 1]
    const latestRate =
      latest.emailsSent > 0
        ? (latest.positiveReplies / latest.emailsSent) * 100
        : 0

    if (avgRate > 0 && latestRate < avgRate * 0.5) {
      anomalies.push({
        type: "REPLY_RATE_DROP",
        severity: latestRate < avgRate * 0.25 ? "critical" : "warning",
        title: "Reply Rate Drop",
        description: `Reply rate ${latestRate.toFixed(1)}% is below 50% of the ${windowSize}-day average (${avgRate.toFixed(1)}%)`,
        date: latest.date,
        currentValue: latestRate,
        expectedValue: avgRate,
      })
    }
  }

  // 3. SEND_BELOW_TARGET: sends below 50% of day-specific target for 2+ consecutive days
  {
    let consecutiveBelow = 0
    let lastBelowDate = ""
    let lastBelowValue = 0
    let lastBelowTarget = 0

    for (let i = history.length - 1; i >= 0; i--) {
      const dayTarget = getTargetForDate(
        history[i].date,
        config.daily_email_target,
        config.daily_targets ?? null
      )
      // Skip days with 0 target (weekends by default)
      if (dayTarget === 0) continue
      if (history[i].emailsSent < dayTarget * 0.5) {
        consecutiveBelow++
        if (consecutiveBelow === 1) {
          lastBelowDate = history[i].date
          lastBelowValue = history[i].emailsSent
          lastBelowTarget = dayTarget
        }
      } else {
        break
      }
    }

    if (consecutiveBelow >= 2) {
      anomalies.push({
        type: "SEND_BELOW_TARGET",
        severity: consecutiveBelow >= 4 ? "critical" : "warning",
        title: "Sends Below Target",
        description: `Sends have been below 50% of target (${lastBelowTarget.toLocaleString()}) for ${consecutiveBelow} consecutive days. Latest: ${lastBelowValue.toLocaleString()}`,
        date: lastBelowDate,
        currentValue: lastBelowValue,
        expectedValue: lastBelowTarget,
      })
    }
  }

  // Sort by severity (critical first), then take max 3
  return anomalies
    .sort((a, b) => {
      if (a.severity === b.severity) return 0
      return a.severity === "critical" ? -1 : 1
    })
    .slice(0, 3)
}

function computeAvgReplyRate(points: AnomalyDataPoint[]): number {
  if (points.length === 0) return 0
  const totalSent = points.reduce((s, p) => s + p.emailsSent, 0)
  const totalReplies = points.reduce(
    (s, p) => s + p.positiveReplies,
    0
  )
  return totalSent > 0 ? (totalReplies / totalSent) * 100 : 0
}
