"use client"

import { useMemo } from "react"
import {
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { replyRateColor } from "@/lib/design-tokens"
import { continuousDates, weekendSpans, MIN_SENDS_FOR_RATE } from "@/lib/chart-utils"
import type { ProviderMatrixDay, ProviderRatePoint } from "@/lib/chart-utils"

/**
 * V4 C2/C3/C4 — the provider truth suite (Omar's follow-up comment):
 *   · ProviderReplyRateChart — % reply rate as a line chart, 4 lines
 *     (Aggregate / Google / Microsoft / Other-SMTP), one instance keyed by
 *     RECIPIENT inbox provider, one by SENDER mailbox provider.
 *   · ProviderMatrixCard — the 3×3 sender × recipient matrix (e.g. "our
 *     Google boxes into Microsoft inboxes"), reply rate + sends per cell.
 * Every surface states its side and window explicitly (V4 C1 — no more
 * "what range is this?").
 */

const LINE_COLORS = {
  aggregate: "#64748b", // slate
  google: "#10b981", // emerald
  microsoft: "#6366f1", // indigo
  other: "#f59e0b", // amber
} as const

const WEEKEND_BAND = "#94a3b8"

const PROVIDERS = ["google", "microsoft", "other"] as const
type ProviderKey = (typeof PROVIDERS)[number]
const PROVIDER_LABELS: Record<ProviderKey, string> = {
  google: "Google",
  microsoft: "Microsoft",
  other: "Other / SMTP",
}

function rateOf(replies: number, sent: number): number | null {
  return sent >= MIN_SENDS_FOR_RATE ? (replies / sent) * 100 : null
}

function periodRate(replies: number, sent: number): string {
  return sent > 0 ? `${((replies / sent) * 100).toFixed(2)}%` : "—"
}

interface ProviderReplyRateChartProps {
  points: ProviderRatePoint[]
  title: string
  /** e.g. "By recipient inbox provider — who we're sending INTO" */
  sideNote: string
  rangeLabel: string
  /** Extra window honesty, e.g. "data from 3 Jun 2026". */
  windowNote?: string
}

export function ProviderReplyRateChart({
  points,
  title,
  sideNote,
  rangeLabel,
  windowNote,
}: ProviderReplyRateChartProps) {
  const { chartData, weekends, totals } = useMemo(() => {
    const byDate = new Map(points.map((p) => [p.date, p]))
    const dates =
      points.length > 0 ? continuousDates(points[0].date, points[points.length - 1].date) : []
    const chartData = dates.map((date) => {
      const p = byDate.get(date)
      return {
        date,
        aggregate: p ? rateOf(p.totalReplies, p.totalSent) : null,
        google: p ? rateOf(p.googleReplies, p.googleSent) : null,
        microsoft: p ? rateOf(p.microsoftReplies, p.microsoftSent) : null,
        other: p ? rateOf(p.otherReplies, p.otherSent) : null,
        sends: p?.totalSent ?? 0,
      }
    })
    const totals = points.reduce(
      (acc, p) => {
        acc.totalSent += p.totalSent
        acc.totalReplies += p.totalReplies
        acc.googleSent += p.googleSent
        acc.googleReplies += p.googleReplies
        acc.microsoftSent += p.microsoftSent
        acc.microsoftReplies += p.microsoftReplies
        acc.otherSent += p.otherSent
        acc.otherReplies += p.otherReplies
        return acc
      },
      {
        totalSent: 0,
        totalReplies: 0,
        googleSent: 0,
        googleReplies: 0,
        microsoftSent: 0,
        microsoftReplies: 0,
        otherSent: 0,
        otherReplies: 0,
      }
    )
    return { chartData, weekends: weekendSpans(dates), totals }
  }, [points])

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-medium">
            {title} — {rangeLabel}
          </CardTitle>
          {/* Period rates per line — the at-a-glance read Omar does aloud */}
          <span className="flex flex-wrap items-center gap-3 text-xs tabular-nums">
            <LegendChip color={LINE_COLORS.aggregate} label="All" value={periodRate(totals.totalReplies, totals.totalSent)} />
            <LegendChip color={LINE_COLORS.google} label="Google" value={periodRate(totals.googleReplies, totals.googleSent)} />
            <LegendChip color={LINE_COLORS.microsoft} label="Microsoft" value={periodRate(totals.microsoftReplies, totals.microsoftSent)} />
            <LegendChip color={LINE_COLORS.other} label="Other" value={periodRate(totals.otherReplies, totals.otherSent)} />
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            No data in the selected range.
          </div>
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
                <Tooltip content={<ProviderRateTooltip />} />
                <Line type="monotone" dataKey="aggregate" name="All" stroke={LINE_COLORS.aggregate} strokeWidth={2.5} connectNulls dot={false} activeDot={{ r: 4 }} animationDuration={600} />
                <Line type="monotone" dataKey="google" name="Google" stroke={LINE_COLORS.google} strokeWidth={1.8} connectNulls dot={false} activeDot={{ r: 3 }} animationDuration={600} />
                <Line type="monotone" dataKey="microsoft" name="Microsoft" stroke={LINE_COLORS.microsoft} strokeWidth={1.8} connectNulls dot={false} activeDot={{ r: 3 }} animationDuration={600} />
                <Line type="monotone" dataKey="other" name="Other / SMTP" stroke={LINE_COLORS.other} strokeWidth={1.8} connectNulls dot={false} activeDot={{ r: 3 }} animationDuration={600} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">
          {sideNote} · replies ÷ sends per day · days under {MIN_SENDS_FOR_RATE} sends to a
          provider are bridged, not spiked · gray band = weekend
          {windowNote ? ` · ${windowNote}` : ""}
        </p>
      </CardContent>
    </Card>
  )
}

function LegendChip({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  )
}

interface ProviderRateTooltipEntry {
  payload?: {
    date: string
    aggregate: number | null
    google: number | null
    microsoft: number | null
    other: number | null
    sends: number
  }
}

function ProviderRateTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ProviderRateTooltipEntry[]
}) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  const row = (label: string, v: number | null, color: string) => (
    <p className="flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}{" "}
      <span className="font-semibold tabular-nums">
        {v !== null ? `${v.toFixed(2)}%` : "—"}
      </span>
    </p>
  )
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md space-y-0.5">
      <p className="font-medium">{format(new Date(`${d.date}T00:00:00`), "EEE, MMM d")}</p>
      {row("All", d.aggregate, LINE_COLORS.aggregate)}
      {row("Google", d.google, LINE_COLORS.google)}
      {row("Microsoft", d.microsoft, LINE_COLORS.microsoft)}
      {row("Other", d.other, LINE_COLORS.other)}
      <p className="text-muted-foreground">{d.sends.toLocaleString()} sends total</p>
    </div>
  )
}

/* ────────────────────────── 3×3 provider matrix ────────────────────────── */

interface ProviderMatrixCardProps {
  /** Window-filtered daily cells (the parent applies the active range). */
  cells: ProviderMatrixDay[]
  rangeLabel: string
  /** Send-event capture start — the earliest honest matrix day. */
  eraStart: string
}

const LOW_VOLUME_SENDS = 100

export function ProviderMatrixCard({ cells, rangeLabel, eraStart }: ProviderMatrixCardProps) {
  const { grid, senderTotals, recipientTotals, grand } = useMemo(() => {
    const grid = new Map<string, { sends: number; replies: number }>()
    for (const c of cells) {
      const key = `${c.sender}|${c.recipient}`
      const cell = grid.get(key) ?? { sends: 0, replies: 0 }
      cell.sends += c.sends
      cell.replies += c.replies
      grid.set(key, cell)
    }
    const senderTotals = new Map<ProviderKey, { sends: number; replies: number }>()
    const recipientTotals = new Map<ProviderKey, { sends: number; replies: number }>()
    const grand = { sends: 0, replies: 0 }
    for (const s of PROVIDERS) {
      for (const r of PROVIDERS) {
        const cell = grid.get(`${s}|${r}`) ?? { sends: 0, replies: 0 }
        const st = senderTotals.get(s) ?? { sends: 0, replies: 0 }
        st.sends += cell.sends
        st.replies += cell.replies
        senderTotals.set(s, st)
        const rt = recipientTotals.get(r) ?? { sends: 0, replies: 0 }
        rt.sends += cell.sends
        rt.replies += cell.replies
        recipientTotals.set(r, rt)
        grand.sends += cell.sends
        grand.replies += cell.replies
      }
    }
    return { grid, senderTotals, recipientTotals, grand }
  }, [cells])

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-medium">
            Provider Matrix (sender × recipient) — {rangeLabel}
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {grand.sends.toLocaleString()} sends · {grand.replies.toLocaleString()} replies
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {grand.sends === 0 && grand.replies === 0 ? (
          <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
            No send-event data in the selected range.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="pb-2 pr-3 text-left font-medium">
                    Sending&nbsp;↓&nbsp;·&nbsp;Into&nbsp;→
                  </th>
                  {PROVIDERS.map((r) => (
                    <th key={r} className="pb-2 px-3 text-center font-medium">
                      {PROVIDER_LABELS[r]}
                    </th>
                  ))}
                  <th className="pb-2 pl-3 text-center font-medium text-muted-foreground/70">
                    All recipients
                  </th>
                </tr>
              </thead>
              <tbody>
                {PROVIDERS.map((s) => (
                  <tr key={s} className="border-t">
                    <td className="py-2.5 pr-3 text-xs font-medium">
                      {PROVIDER_LABELS[s]}
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        our {PROVIDER_LABELS[s]} boxes
                      </span>
                    </td>
                    {PROVIDERS.map((r) => (
                      <td key={r} className="px-3 py-2.5 text-center align-top">
                        <MatrixCell cell={grid.get(`${s}|${r}`)} />
                      </td>
                    ))}
                    <td className="pl-3 py-2.5 text-center align-top opacity-70">
                      <MatrixCell cell={senderTotals.get(s)} />
                    </td>
                  </tr>
                ))}
                <tr className="border-t">
                  <td className="py-2.5 pr-3 text-xs font-medium text-muted-foreground/70">
                    All senders
                  </td>
                  {PROVIDERS.map((r) => (
                    <td key={r} className="px-3 py-2.5 text-center align-top opacity-70">
                      <MatrixCell cell={recipientTotals.get(r)} />
                    </td>
                  ))}
                  <td className="pl-3 py-2.5 text-center align-top opacity-70">
                    <MatrixCell cell={grand} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Reply rate = replies ÷ sends within the range, per sender-pool ×
          recipient-inbox pair · cells under {LOW_VOLUME_SENDS} sends are greyed
          (low volume) · data from{" "}
          {format(new Date(`${eraStart}T00:00:00`), "d MMM yyyy")} (send-event capture)
        </p>
      </CardContent>
    </Card>
  )
}

function MatrixCell({ cell }: { cell?: { sends: number; replies: number } }) {
  if (!cell || (cell.sends === 0 && cell.replies === 0)) {
    return <span className="text-muted-foreground">—</span>
  }
  if (cell.sends === 0) {
    // Replies landed in a window with no sends (e.g. weekend stragglers)
    return (
      <span
        className="text-muted-foreground"
        title={`${cell.replies} replies but 0 sends in this range`}
      >
        —
      </span>
    )
  }
  const rate = (cell.replies / cell.sends) * 100
  const lowVolume = cell.sends < LOW_VOLUME_SENDS
  const colors = replyRateColor(rate)
  return (
    <div title={lowVolume ? "Low volume — read with caution" : undefined}>
      <div
        className={`text-base font-bold tabular-nums ${
          lowVolume ? "text-muted-foreground" : colors.text
        }`}
      >
        {rate.toFixed(2)}%
      </div>
      <div className="text-[10px] text-muted-foreground tabular-nums">
        {cell.replies.toLocaleString()} / {cell.sends.toLocaleString()} sends
      </div>
    </div>
  )
}
