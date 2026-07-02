"use client"

import React from "react"
import type { ClientSnapshot } from "@/types/analytics"

interface PerformanceCardProps {
  snapshot: ClientSnapshot
  leadsContacted: number
  replyTrend?: { pct: number; direction: "up" | "down" | "flat" } | null
}

interface Grade {
  label: string
  textColor: string
  bgColor: string
  borderColor: string
}

function getGrade(leadsPerReply: number | null): Grade {
  if (leadsPerReply === null) return { label: "No data", textColor: "text-gray-500", bgColor: "bg-gray-100", borderColor: "border-gray-200" }
  if (leadsPerReply <= 150)  return { label: "Excellent",  textColor: "text-emerald-700", bgColor: "bg-emerald-50",  borderColor: "border-emerald-200" }
  if (leadsPerReply <= 400)  return { label: "Above Avg",  textColor: "text-teal-700",    bgColor: "bg-teal-50",    borderColor: "border-teal-200" }
  if (leadsPerReply <= 800)  return { label: "Average",    textColor: "text-amber-700",   bgColor: "bg-amber-50",   borderColor: "border-amber-200" }
  if (leadsPerReply <= 1200) return { label: "Poor", textColor: "text-orange-700",  bgColor: "bg-orange-50",  borderColor: "border-orange-200" }
  return                            { label: "Fail", textColor: "text-red-700",     bgColor: "bg-red-50",     borderColor: "border-red-200" }
}

// 5 benchmark zones for the visual band
const ZONES: { max: number; bg: string }[] = [
  { max: 150,  bg: "bg-emerald-400" },
  { max: 400,  bg: "bg-teal-400" },
  { max: 800,  bg: "bg-amber-400" },
  { max: 1200, bg: "bg-orange-400" },
  { max: 1500, bg: "bg-red-400" },
]

export function PerformanceCard({ snapshot, leadsContacted, replyTrend }: PerformanceCardProps) {
  const { all_time_emails_sent, all_time_interested } = snapshot

  const replyRate =
    all_time_emails_sent > 0
      ? (all_time_interested / all_time_emails_sent) * 100
      : 0

  const emailsPerReply =
    all_time_interested > 0
      ? all_time_emails_sent / all_time_interested
      : null

  const leadsPerReply =
    all_time_interested > 0 && leadsContacted > 0
      ? leadsContacted / all_time_interested
      : null

  const grade = getGrade(leadsPerReply)

  const rateColor =
    replyRate > 1 ? "text-emerald-600" : replyRate > 0.3 ? "text-amber-600" : "text-gray-600"

  // Position marker on benchmark band (0–1500 scale, capped)
  const markerPct = leadsPerReply !== null
    ? Math.min((leadsPerReply / 1500) * 100, 100)
    : null

  return (
    <div
      data-testid="performance-card"
      className="rounded-lg border border-gray-200 bg-white px-5 py-4"
    >
      {/* Primary: reply rate + grade pill */}
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-semibold tabular-nums tracking-tight ${rateColor}`}>
            {replyRate.toFixed(2)}%
          </span>
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Reply Rate
          </span>
          {replyTrend && (() => {
            const styles = { up: "text-emerald-600", down: "text-red-600", flat: "text-gray-500" }
            const arrows = { up: "▲", down: "▼", flat: "→" }
            return (
              <span
                data-testid="trend-badge"
                className={`inline-flex items-center gap-0.5 text-xs font-semibold ${styles[replyTrend.direction]}`}
              >
                {arrows[replyTrend.direction]} {replyTrend.direction === "flat" ? "flat" : `${replyTrend.pct}%`}
              </span>
            )
          })()}
        </div>
        {/* Grade pill */}
        <span className={`ml-auto rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${grade.bgColor} ${grade.textColor} ${grade.borderColor}`}>
          {grade.label}
        </span>
      </div>

      {/* Benchmark band: 5 colour zones with a position marker */}
      <div className="mt-3">
        <div className="relative flex h-2 w-full overflow-visible rounded-full">
          {ZONES.map((zone, i) => (
            <div
              key={zone.max}
              className={`h-full flex-1 ${zone.bg} ${i === 0 ? "rounded-l-full" : ""} ${i === ZONES.length - 1 ? "rounded-r-full" : ""}`}
            />
          ))}
          {/* Position marker */}
          {markerPct !== null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full border-2 border-white bg-gray-900 shadow"
              style={{ left: `${markerPct}%` }}
            />
          )}
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-gray-400">
          <span>≤150</span>
          <span>400</span>
          <span>800</span>
          <span>1,200</span>
          <span>1,500+</span>
        </div>
        <div className="mt-0.5 text-[9px] text-gray-400 text-center">leads per reply benchmark</div>
      </div>

      {/* Secondary: efficiency stats */}
      <div className="mt-3 flex gap-6">
        <div>
          <span className="text-lg font-semibold tabular-nums text-gray-900">
            {emailsPerReply !== null ? emailsPerReply.toFixed(0) : "—"}
          </span>
          <span className="ml-1 text-xs text-gray-500">emails/reply</span>
        </div>
        <div>
          <span className="text-lg font-semibold tabular-nums text-gray-900">
            {leadsPerReply !== null ? leadsPerReply.toFixed(0) : "—"}
          </span>
          <span className="ml-1 text-xs text-gray-500">leads/reply</span>
        </div>
      </div>

      {/* Tertiary: raw totals */}
      <div className="mt-2 flex gap-4 text-xs text-gray-400">
        <span>{all_time_emails_sent.toLocaleString()} sent</span>
        <span>{all_time_interested.toLocaleString()} replies</span>
      </div>
    </div>
  )
}
