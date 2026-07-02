"use client"

import React, { useState } from "react"
import type { ClientSnapshot } from "@/types/analytics"

interface PipelineFunnelProps {
  snapshot: ClientSnapshot
}

interface FunnelSegment {
  key: string
  label: string
  count: number
  color: string
  barColor: string
  dotColor: string
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`
  return n.toLocaleString()
}

export function PipelineFunnel({ snapshot }: PipelineFunnelProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; pct: number } | null>(null)

  const segments: FunnelSegment[] = [
    { key: "ready",       label: "Ready",       count: snapshot.ready_leads,       color: "text-gray-600",    barColor: "bg-gray-300",    dotColor: "bg-gray-400" },
    { key: "not_started", label: "Not Started", count: snapshot.leads_not_started, color: "text-slate-600",   barColor: "bg-slate-400",   dotColor: "bg-slate-500" },
    { key: "in_progress", label: "In Progress", count: snapshot.leads_in_progress, color: "text-blue-600",    barColor: "bg-blue-500",    dotColor: "bg-blue-500" },
    { key: "completed",   label: "Completed",   count: snapshot.leads_completed,   color: "text-emerald-600", barColor: "bg-emerald-500", dotColor: "bg-emerald-500" },
    { key: "blocked",     label: "Blocked",     count: snapshot.leads_blocked,     color: "text-red-600",     barColor: "bg-red-400",     dotColor: "bg-red-400" },
  ]

  const total = segments.reduce((sum, s) => sum + s.count, 0)

  const hoveredSeg = hoveredKey ? segments.find((s) => s.key === hoveredKey) : null

  return (
    <div
      data-testid="pipeline-funnel"
      className="rounded-lg border border-gray-200 bg-white px-5 py-4"
    >
      {/* Segmented bar with tooltip */}
      <div className="relative">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
          {total > 0 &&
            segments.map((seg) => {
              const pct = (seg.count / total) * 100
              if (pct === 0) return null
              return (
                <div
                  key={seg.key}
                  className={`${seg.barColor} cursor-pointer transition-opacity duration-150 ${hoveredKey && hoveredKey !== seg.key ? "opacity-50" : "opacity-100"}`}
                  style={{ width: `${pct}%` }}
                  onMouseEnter={(e) => {
                    setHoveredKey(seg.key)
                    const rect = (e.currentTarget.closest("[data-testid='pipeline-funnel']") as HTMLElement)?.querySelector(".flex.h-3")?.getBoundingClientRect()
                    const segRect = e.currentTarget.getBoundingClientRect()
                    if (rect) {
                      const midX = segRect.left - rect.left + segRect.width / 2
                      setTooltipPos({ x: midX, pct })
                    }
                  }}
                  onMouseLeave={() => { setHoveredKey(null); setTooltipPos(null) }}
                />
              )
            })}
        </div>

        {/* Hover tooltip */}
        {hoveredSeg && tooltipPos && (
          <div
            className="pointer-events-none absolute -top-10 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
            style={{ left: tooltipPos.x }}
          >
            <span className="font-semibold">{hoveredSeg.label}</span>
            {" · "}
            {formatNumber(hoveredSeg.count)}
            {" · "}
            {tooltipPos.pct.toFixed(1)}%
            <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {segments.map((seg) => {
          const pct = total > 0 ? (seg.count / total) * 100 : 0
          return (
            <div
              key={seg.key}
              className="flex items-center gap-1.5 cursor-default"
              onMouseEnter={() => setHoveredKey(seg.key)}
              onMouseLeave={() => setHoveredKey(null)}
            >
              <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${seg.dotColor}`} />
              <div className="flex flex-col leading-tight">
                <span className={`text-sm font-semibold tabular-nums ${seg.color}`}>
                  {formatNumber(seg.count)}
                </span>
                <span className="text-xs text-gray-500">{seg.label}</span>
                <span className="text-[10px] text-gray-400">{pct.toFixed(1)}%</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Total summary */}
      <div className="mt-2 text-xs text-gray-400">
        {formatNumber(total)} total leads tracked
      </div>
    </div>
  )
}
