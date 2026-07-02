"use client"

import React, { useMemo } from "react"
import {
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceArea,
} from "recharts"
import type { DailyPoint, CampaignSnapshot, ClientSnapshot } from "@/types/analytics"
import { formatCampaignName } from "@/lib/utils"

interface PerformanceTrendChartProps {
  chartData: DailyPoint[]
  campaigns: CampaignSnapshot[]
  clientSlug: string
  snapshot: ClientSnapshot | null
}

// ─── Grade helpers ───────────────────────────────────────────────────────────

interface Grade {
  label: string
  textColor: string
  bgColor: string
  sortVal: number
}

function getGradeFromLeadsPerReply(lpr: number | null): Grade {
  if (lpr === null) return { label: "No data",   textColor: "text-gray-500",   bgColor: "bg-gray-100",   sortVal: 999 }
  if (lpr <= 150)   return { label: "Excellent",  textColor: "text-emerald-700", bgColor: "bg-emerald-50", sortVal: 1 }
  if (lpr <= 400)   return { label: "Above Avg",  textColor: "text-teal-700",    bgColor: "bg-teal-50",    sortVal: 2 }
  if (lpr <= 800)   return { label: "Average",    textColor: "text-amber-700",   bgColor: "bg-amber-50",   sortVal: 3 }
  if (lpr <= 1200)  return { label: "Poor", textColor: "text-orange-700",  bgColor: "bg-orange-50",  sortVal: 4 }
  return                   { label: "Fail", textColor: "text-red-700",     bgColor: "bg-red-50",     sortVal: 5 }
}

interface GradeThresholds {
  excellent: number
  aboveAvg: number
  average: number
  belowAvg: number
}

function getGradeFromEmailsPerReply(epr: number | null, t: GradeThresholds): Grade {
  if (epr === null) return { label: "No data",   textColor: "text-gray-500",   bgColor: "bg-gray-100",   sortVal: 999 }
  if (epr <= t.excellent) return { label: "Excellent",  textColor: "text-emerald-700", bgColor: "bg-emerald-50", sortVal: 1 }
  if (epr <= t.aboveAvg)  return { label: "Above Avg",  textColor: "text-teal-700",    bgColor: "bg-teal-50",    sortVal: 2 }
  if (epr <= t.average)   return { label: "Average",    textColor: "text-amber-700",   bgColor: "bg-amber-50",   sortVal: 3 }
  if (epr <= t.belowAvg)  return { label: "Poor", textColor: "text-orange-700",  bgColor: "bg-orange-50",  sortVal: 4 }
  return                          { label: "Fail", textColor: "text-red-700",     bgColor: "bg-red-50",     sortVal: 5 }
}

const GRADE_DOT_COLORS: Record<number, string> = {
  1: "#10b981",
  2: "#0d9488",
  3: "#f59e0b",
  4: "#f97316",
  5: "#ef4444",
  999: "#9ca3af",
}

// ─── Date formatting ─────────────────────────────────────────────────────────

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z")
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
}

// ─── Rolling computation ─────────────────────────────────────────────────────

interface RollingPoint {
  date: string
  label: string
  emailsPerReply: number | null  // null = no sends (inactive gap); yMaxBase = zero-reply floor
  isZeroReplyDay: boolean
  isWeekend: boolean
  rawSends: number
  rawReplies: number
}

function computeRolling(data: DailyPoint[], yMaxBase: number): RollingPoint[] {
  return data.map((_, i) => {
    const window = data.slice(Math.max(0, i - 6), i + 1)
    const totalSends   = window.reduce((s, d) => s + d.emails_sent_count, 0)
    const totalReplies = window.reduce((s, d) => s + d.positive_replies_count, 0)
    const rawSends   = data[i].emails_sent_count
    const rawReplies = data[i].positive_replies_count
    const isZeroReplyDay = rawSends > 0 && rawReplies === 0
    const dayOfWeek = new Date(data[i].date + "T00:00:00Z").getUTCDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const isWeekendNoSends = isWeekend && rawSends === 0

    return {
      date:            data[i].date,
      label:           formatDateShort(data[i].date),
      // null = no activity (gap); yMaxBase = bad day or weekend no-send → line drops to floor
      emailsPerReply:  isZeroReplyDay || isWeekendNoSends
        ? yMaxBase
        : totalReplies > 0
            ? totalSends / totalReplies
            : null,
      isZeroReplyDay,
      isWeekend,
      rawSends,
      rawReplies,
    }
  })
}

// ─── Trend (lower emailsPerReply = improving) ─────────────────────────────────

function computeTrend(points: RollingPoint[], yMaxBase: number): { pct: number; direction: "improving" | "worsening" | "flat" } | null {
  // Exclude floor-pinned (zero-reply) days and weekends from trend calculation
  const valid = points.filter((p) => p.emailsPerReply !== null && !p.isZeroReplyDay && !p.isWeekend)
  if (valid.length < 14) return null
  const recent = valid.slice(-7).map((p) => p.emailsPerReply as number)
  const prior  = valid.slice(-14, -7).map((p) => p.emailsPerReply as number)
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length
  const recentAvg = avg(recent)
  const priorAvg  = avg(prior)
  if (priorAvg === 0 && recentAvg === 0) return { pct: 0, direction: "flat" }
  if (priorAvg === 0) return { pct: 100, direction: "worsening" }
  const pct = ((recentAvg - priorAvg) / priorAvg) * 100
  const direction = pct < -5 ? "improving" : pct > 5 ? "worsening" : "flat"
  return { pct: Math.abs(Math.round(pct)), direction }
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: RollingPoint }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const pt = payload[0].payload
  const epr = pt.emailsPerReply
  const isFloor = pt.isZeroReplyDay
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-md text-xs min-w-[160px]">
      <div className="font-semibold text-gray-900 mb-1.5">{pt.label}</div>
      <div className="flex justify-between gap-4 text-gray-600">
        <span>Sends</span>
        <span className="font-medium text-gray-900">{pt.rawSends.toLocaleString()}</span>
      </div>
      <div className="flex justify-between gap-4 text-gray-600">
        <span>Replies</span>
        <span className={`font-medium ${isFloor && !pt.isWeekend ? "text-red-600" : "text-gray-900"}`}>
          {pt.rawReplies}{isFloor && !pt.isWeekend ? " ⚠ No replies" : ""}
        </span>
      </div>
      {pt.isWeekend && pt.rawReplies === 0 && (
        <div className="mt-1 text-[10px] text-gray-400 italic">Weekend — expected quiet</div>
      )}
      <div className="flex justify-between gap-4 text-gray-600 mt-1.5 pt-1.5 border-t border-gray-100">
        <span>7-day avg</span>
        <span className="font-semibold text-gray-900">
          {isFloor && !pt.isWeekend
            ? "Fail (0 replies)"
            : pt.isWeekend && pt.rawSends === 0
            ? "No sends"
            : epr !== null
            ? `${Math.round(epr).toLocaleString()} emails/reply`
            : "—"}
        </span>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function PerformanceTrendChart({
  chartData,
  campaigns,
  snapshot,
}: PerformanceTrendChartProps) {
  const leadsContacted = snapshot
    ? snapshot.leads_in_progress + snapshot.leads_completed + snapshot.leads_blocked
    : 0
  const emailsPerLead = snapshot && leadsContacted > 0
    ? snapshot.all_time_emails_sent / leadsContacted
    : 5

  const thresholds: GradeThresholds = {
    excellent: 150 * emailsPerLead,
    aboveAvg:  400 * emailsPerLead,
    average:   800 * emailsPerLead,
    belowAvg:  1200 * emailsPerLead,
  }

  const yMaxBase = thresholds.belowAvg * 1.5

  const rollingPoints = useMemo(
    () => computeRolling(chartData, yMaxBase),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chartData, yMaxBase]
  )

  const trend = useMemo(() => computeTrend(rollingPoints, yMaxBase), [rollingPoints, yMaxBase])

  const maxActiveValue = useMemo(() => {
    const vals = rollingPoints
      .filter((p) => !p.isZeroReplyDay)
      .map((p) => p.emailsPerReply ?? 0)
    return Math.max(...vals, 0)
  }, [rollingPoints])

  const yMax = Math.max(yMaxBase, maxActiveValue * 1.1)

  // Right axis: reply volume — scaled so bars stay in lower ~25% of chart area
  const maxReplies = useMemo(() => {
    return Math.max(...rollingPoints.map((p) => p.rawReplies), 1)
  }, [rollingPoints])
  const replyYMax = maxReplies * 4

  const hasData = rollingPoints.some((p) => p.emailsPerReply !== null || p.isZeroReplyDay)

  const yTicks = [0, thresholds.excellent, thresholds.aboveAvg, thresholds.average, thresholds.belowAvg]
    .filter((t) => t <= yMax)
    .map((t) => Math.round(t))

  const yTickFormatter = (v: number) => {
    if (v === 0) return "0"
    if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k`
    return `${Math.round(v)}`
  }

  const primaryCampaigns = campaigns.filter((c) => c.campaign_type !== "subsequence")
  const campaignsWithGrade = primaryCampaigns
    .map((c) => {
      const lc  = c.leads_in_progress + c.leads_completed + c.leads_blocked
      const lpr = c.all_time_interested > 0 && lc > 0 ? lc / c.all_time_interested : null
      return { campaign: c, lpr, grade: getGradeFromLeadsPerReply(lpr) }
    })
    .filter((x) => x.lpr !== null)
    .sort((a, b) => a.grade.sortVal - b.grade.sortVal)

  const boosting = campaignsWithGrade.slice(0, 3)
  const dragging = campaignsWithGrade.slice().reverse().filter((x) => x.grade.sortVal !== 999).slice(0, 3)

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-5 py-4">

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Performance Trend
          </h3>
          <p className="mt-0.5 text-[11px] text-gray-400">
            7-day rolling emails/reply · up = improving · bars = daily replies
          </p>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold shrink-0 ${
            trend.direction === "improving"
              ? "bg-emerald-50 text-emerald-700"
              : trend.direction === "worsening"
              ? "bg-red-50 text-red-700"
              : "bg-gray-100 text-gray-600"
          }`}>
            {trend.direction === "improving" ? "▲" : trend.direction === "worsening" ? "▼" : "→"}
            {" "}
            {trend.direction === "flat"
              ? "Flat WoW"
              : `${trend.pct}% ${trend.direction === "improving" ? "better" : "worse"} WoW`}
          </div>
        )}
      </div>

      {/* Chart */}
      {hasData ? (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={rollingPoints} margin={{ top: 4, right: 64, bottom: 0, left: 0 }}>

              {/* Grade band backgrounds */}
              <ReferenceArea yAxisId="efficiency" y1={0}                    y2={thresholds.excellent} fill="#d1fae5" fillOpacity={0.55} ifOverflow="visible" />
              <ReferenceArea yAxisId="efficiency" y1={thresholds.excellent} y2={thresholds.aboveAvg}  fill="#ccfbf1" fillOpacity={0.60} ifOverflow="visible" />
              <ReferenceArea yAxisId="efficiency" y1={thresholds.aboveAvg}  y2={thresholds.average}   fill="#fef3c7" fillOpacity={0.60} ifOverflow="visible" />
              <ReferenceArea yAxisId="efficiency" y1={thresholds.average}   y2={thresholds.belowAvg}  fill="#ffedd5" fillOpacity={0.60} ifOverflow="visible" />
              <ReferenceArea yAxisId="efficiency" y1={thresholds.belowAvg}  y2={yMax}                 fill="#fee2e2" fillOpacity={0.60} ifOverflow="visible" />

              {/* Grade labels */}
              <ReferenceArea yAxisId="efficiency" y1={0}                    y2={thresholds.excellent} label={{ value: "Excellent", position: "insideRight", fontSize: 9, fill: "#059669", dx: 60 }} fill="none" />
              <ReferenceArea yAxisId="efficiency" y1={thresholds.excellent} y2={thresholds.aboveAvg}  label={{ value: "Above Avg", position: "insideRight", fontSize: 9, fill: "#0d9488", dx: 60 }} fill="none" />
              <ReferenceArea yAxisId="efficiency" y1={thresholds.aboveAvg}  y2={thresholds.average}   label={{ value: "Average",   position: "insideRight", fontSize: 9, fill: "#d97706", dx: 60 }} fill="none" />
              <ReferenceArea yAxisId="efficiency" y1={thresholds.average}   y2={thresholds.belowAvg}  label={{ value: "Poor", position: "insideRight", fontSize: 9, fill: "#ea580c", dx: 60 }} fill="none" />
              <ReferenceArea yAxisId="efficiency" y1={thresholds.belowAvg}  y2={yMax}                 label={{ value: "Fail", position: "insideRight", fontSize: 9, fill: "#dc2626", dx: 60 }} fill="none" />

              {/* Weekend column shading */}
              {rollingPoints
                .filter((p) => p.isWeekend)
                .map((p) => (
                  <ReferenceArea
                    key={`weekend-${p.date}`}
                    yAxisId="efficiency"
                    x1={p.label}
                    x2={p.label}
                    fill="#9ca3af"
                    fillOpacity={0.12}
                    ifOverflow="visible"
                  />
                ))}

              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />

              {/* Left axis: emails/reply (reversed — low = top = good) */}
              <YAxis
                yAxisId="efficiency"
                reversed={true}
                domain={[0, yMax]}
                ticks={yTicks}
                tickFormatter={yTickFormatter}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                width={46}
              />

              {/* Right axis: daily reply count */}
              <YAxis
                yAxisId="replies"
                orientation="right"
                domain={[0, replyYMax]}
                tick={{ fontSize: 10, fill: "#c4b5fd" }}
                tickLine={false}
                axisLine={false}
                width={28}
                tickFormatter={(v: number) => v === 0 ? "" : String(v)}
              />

              <Tooltip content={<CustomTooltip />} />

              {/* Reply volume bars (behind the line) */}
              <Bar
                yAxisId="replies"
                dataKey="rawReplies"
                fill="#8b5cf6"
                fillOpacity={0.2}
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />

              {/* Area fill under the efficiency line */}
              <Area
                yAxisId="efficiency"
                type="monotone"
                dataKey="emailsPerReply"
                stroke="none"
                fill="#6366f1"
                fillOpacity={0.05}
                connectNulls={false}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />

              {/* Efficiency line with grade-colored dots */}
              <Line
                yAxisId="efficiency"
                type="monotone"
                dataKey="emailsPerReply"
                stroke="#6366f1"
                strokeWidth={2}
                connectNulls={false}
                isAnimationActive={false}
                dot={(props: { cx?: number; cy?: number; payload?: RollingPoint; index?: number }) => {
                  const { cx, cy, payload, index } = props
                  if (cx == null || cy == null || !payload || payload.emailsPerReply === null) {
                    return <g key={`dot-empty-${index}`} />
                  }
                  // Weekend quiet → gray (expected); weekday zero-reply → red (unexpected miss)
                  const isWeekendQuiet = payload.isWeekend && payload.rawReplies === 0
                  const grade = isWeekendQuiet
                    ? { sortVal: 999 }
                    : payload.isZeroReplyDay
                    ? { sortVal: 5 }
                    : getGradeFromEmailsPerReply(payload.emailsPerReply, thresholds)
                  const color = GRADE_DOT_COLORS[grade.sortVal] ?? "#6366f1"
                  return (
                    <circle
                      key={`dot-${payload.date}`}
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill={color}
                      stroke="white"
                      strokeWidth={1.5}
                    />
                  )
                }}
                activeDot={{ r: 5, stroke: "white", strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500">
            {[
              { color: "#10b981", label: "Excellent" },
              { color: "#0d9488", label: "Above Avg" },
              { color: "#f59e0b", label: "Average" },
              { color: "#f97316", label: "Poor" },
              { color: "#ef4444", label: "Fail / No replies" },
              { color: "#9ca3af", label: "Weekend quiet" },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full flex-shrink-0" style={{ background: color }} />
                {label}
              </span>
            ))}
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm flex-shrink-0" style={{ background: "#8b5cf6", opacity: 0.5 }} />
              Daily replies
            </span>
          </div>
        </>
      ) : (
        <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">
          Not enough data yet — check back after a few days of sends
        </div>
      )}

      {/* Campaign drivers */}
      {campaignsWithGrade.length > 0 && (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
            What&apos;s driving this
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-2 text-[10px] font-medium text-emerald-600 uppercase tracking-wide">Best performing</p>
              <div className="flex flex-col gap-2.5">
                {boosting.map(({ campaign, lpr, grade }) => {
                  const { displayName, version } = formatCampaignName(campaign.campaign_name)
                  return (
                    <div key={campaign.campaign_id} className="flex items-start gap-2 min-w-0">
                      <span className={`shrink-0 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${grade.bgColor} ${grade.textColor}`}>
                        {grade.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="truncate text-xs font-medium text-gray-800" title={displayName}>{displayName}</span>
                          {version && (
                            <span className="shrink-0 rounded bg-gray-100 px-1 py-px text-[9px] font-semibold text-gray-500 uppercase">{version}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400">{lpr !== null ? `${Math.round(lpr)} leads/reply` : "—"}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-medium text-red-500 uppercase tracking-wide">Needs attention</p>
              <div className="flex flex-col gap-2.5">
                {dragging.map(({ campaign, lpr, grade }) => {
                  const { displayName, version } = formatCampaignName(campaign.campaign_name)
                  return (
                    <div key={campaign.campaign_id} className="flex items-start gap-2 min-w-0">
                      <span className={`shrink-0 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${grade.bgColor} ${grade.textColor}`}>
                        {grade.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="truncate text-xs font-medium text-gray-800" title={displayName}>{displayName}</span>
                          {version && (
                            <span className="shrink-0 rounded bg-gray-100 px-1 py-px text-[9px] font-semibold text-gray-500 uppercase">{version}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400">{lpr !== null ? `${Math.round(lpr)} leads/reply` : "—"}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
