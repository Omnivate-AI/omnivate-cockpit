"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { ClientCapacityRow, ClientMailboxRow } from "@/lib/queries/mailboxes"

interface LifecycleBreakdownProps {
  data: ClientCapacityRow
  /** Full mailbox inventory — powers the per-state domain drill-down. */
  mailboxes: ClientMailboxRow[]
}

interface Segment {
  label: string
  key: string
  count: number
  color: string
  barColor: string
}

const BURN_THRESHOLD = 97

export function LifecycleBreakdown({ data, mailboxes }: LifecycleBreakdownProps) {
  // sp_* lifecycle vocabulary: active/resting (1-week rotation), reserve,
  // warming, parked, burnt, retired. (ramping/draining don't exist anymore.)
  const segments: Segment[] = [
    { label: "Active",  key: "active",  count: data.active,  color: "text-emerald-600", barColor: "bg-emerald-500" },
    { label: "Resting", key: "resting", count: data.resting, color: "text-teal-600",    barColor: "bg-teal-500" },
    { label: "Reserve", key: "reserve", count: data.reserve, color: "text-amber-600",   barColor: "bg-amber-500" },
    { label: "Warming", key: "warming", count: data.warming, color: "text-sky-600",     barColor: "bg-sky-500" },
    { label: "Parked",  key: "parked",  count: data.parked,  color: "text-zinc-500",    barColor: "bg-zinc-400" },
    { label: "Burnt",   key: "burnt",   count: data.burnt,   color: "text-rose-600",    barColor: "bg-rose-500" },
    { label: "Retired", key: "retired", count: data.retired, color: "text-gray-500",    barColor: "bg-gray-400" },
  ]
  const total = segments.reduce((s, x) => s + x.count, 0) || 1

  const [openState, setOpenState] = useState<string | null>(null)
  const toggle = (key: string) => setOpenState((cur) => (cur === key ? null : key))

  const openSegment = segments.find((s) => s.key === openState) ?? null

  return (
    <Card>
      <CardContent className="px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">Lifecycle Distribution</p>
          <span className="text-xs text-muted-foreground">{data.total} mailboxes total</span>
        </div>

        {/* Stacked horizontal bar */}
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
          {segments.map((s) =>
            s.count === 0 ? null : (
              <div
                key={s.label}
                className={cn("h-full", s.barColor)}
                style={{ width: `${(s.count / total) * 100}%` }}
                title={`${s.label}: ${s.count}`}
              />
            )
          )}
        </div>

        {/* Legend — each state with boxes is a button that drills into its
            per-domain list (V2 Phase 7 domain drill-down). */}
        <div className="mt-3 grid grid-cols-4 gap-x-3 gap-y-1 sm:grid-cols-7">
          {segments.map((s) => {
            const clickable = s.count > 0
            return (
              <button
                key={s.label}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && toggle(s.key)}
                aria-expanded={openState === s.key}
                className={cn(
                  "flex items-center gap-1.5 rounded px-1 py-0.5 text-xs transition-colors",
                  clickable
                    ? "cursor-pointer hover:bg-muted"
                    : "cursor-default opacity-60",
                  openState === s.key && "bg-muted ring-1 ring-border"
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", s.barColor)} />
                <span className="text-muted-foreground">{s.label}</span>
                <span className={cn("ml-auto font-semibold tabular-nums", s.color)}>{s.count}</span>
                {clickable && (
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 text-muted-foreground transition-transform",
                      openState === s.key ? "rotate-180" : ""
                    )}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Rotation state (INFRA-5) */}
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t pt-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Weekly rotation:</span>
          <span className="tabular-nums">
            {data.active} active ↔ {data.resting} resting
          </span>
          {data.reserve > 0 && (
            <span className="tabular-nums">
              · {data.reserve} in reserve
              {data.target_reserve_mailboxes !== null &&
                ` (target ${data.target_reserve_mailboxes})`}
            </span>
          )}
          {data.resting === 0 && data.active > 0 && (
            <span className="font-medium text-amber-600 dark:text-amber-400">
              · no resting pool — rotation has nowhere to swap
            </span>
          )}
        </div>

        {/* Drill-down: domains whose mailboxes are in the selected state */}
        {openSegment && (
          <DomainDrilldown
            stateLabel={openSegment.label}
            stateKey={openSegment.key}
            mailboxes={mailboxes}
          />
        )}
      </CardContent>
    </Card>
  )
}

interface DomainGroup {
  domain: string
  boxes: number
  worst: number | null
  median: number | null
  tags: string[]
  oldest: string | null
}

function DomainDrilldown({
  stateLabel,
  stateKey,
  mailboxes,
}: {
  stateLabel: string
  stateKey: string
  mailboxes: ClientMailboxRow[]
}) {
  const inState = mailboxes.filter(
    (m) => m.lifecycle_status === stateKey && !m.is_master_inbox
  )

  const byDomain = new Map<string, ClientMailboxRow[]>()
  for (const m of inState) {
    const d = m.domain_name || "(no domain)"
    if (!byDomain.has(d)) byDomain.set(d, [])
    byDomain.get(d)!.push(m)
  }

  const groups: DomainGroup[] = [...byDomain.entries()].map(([domain, boxes]) => {
    const warmups = boxes
      .map((b) => b.warmup_health_pct)
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b)
    const tags = [...new Set(boxes.flatMap((b) => b.smartlead_tags ?? []))].sort()
    const created = boxes
      .map((b) => b.created_at)
      .filter((v): v is string => !!v)
      .sort()
    return {
      domain,
      boxes: boxes.length,
      worst: warmups.length ? warmups[0] : null,
      median: warmups.length ? warmups[Math.floor((warmups.length - 1) / 2)] : null,
      tags,
      oldest: created[0] ?? null,
    }
  })
  groups.sort((a, b) => (a.worst ?? 101) - (b.worst ?? 101) || a.domain.localeCompare(b.domain))

  if (groups.length === 0) {
    return (
      <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">
        No {stateLabel.toLowerCase()} mailboxes.
      </p>
    )
  }

  return (
    <div className="mt-3 border-t pt-2">
      <p className="mb-2 text-xs font-medium">
        {stateLabel} domains{" "}
        <span className="text-muted-foreground">
          ({groups.length} domain{groups.length === 1 ? "" : "s"} ·{" "}
          {inState.length} mailbox{inState.length === 1 ? "" : "es"})
        </span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-1 pr-3 font-medium">Domain</th>
              <th className="pb-1 pr-3 font-medium">Boxes</th>
              <th className="pb-1 pr-3 font-medium">Warmup</th>
              <th className="pb-1 pr-3 font-medium">Tags</th>
              <th className="pb-1 font-medium">Age</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.domain} className="border-b last:border-0 align-top">
                <td className="py-1 pr-3 font-medium">{g.domain}</td>
                <td className="py-1 pr-3 tabular-nums">{g.boxes}</td>
                <td className="py-1 pr-3 tabular-nums">
                  {g.worst == null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span
                      className={
                        g.worst < BURN_THRESHOLD
                          ? "font-semibold text-rose-600 dark:text-rose-400"
                          : ""
                      }
                    >
                      {g.worst.toFixed(0)}
                      {g.median != null && g.median !== g.worst && (
                        <span className="text-muted-foreground">
                          {" "}
                          · med {g.median.toFixed(0)}
                        </span>
                      )}
                    </span>
                  )}
                </td>
                <td className="py-1 pr-3">
                  {g.tags.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {g.tags.slice(0, 4).map((t) => (
                        <span
                          key={t}
                          className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                      {g.tags.length > 4 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{g.tags.length - 4}
                        </span>
                      )}
                    </span>
                  )}
                </td>
                <td className="py-1 tabular-nums text-muted-foreground">
                  {ageLabel(g.oldest)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ageLabel(oldest: string | null): string {
  if (!oldest) return "—"
  const then = new Date(oldest).getTime()
  if (Number.isNaN(then)) return "—"
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days < 1) return "today"
  if (days < 30) return `${days}d`
  const months = Math.floor(days / 30)
  return `${months}mo`
}
