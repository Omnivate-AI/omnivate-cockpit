"use client"

import { memo } from "react"

interface MiniSparklineProps {
  /** Array of numeric values to plot */
  data: number[]
  /** Width in pixels */
  width?: number
  /** Height in pixels */
  height?: number
  /** Stroke color */
  color?: string
  /** Fill under the line */
  fill?: boolean
}

/**
 * Lightweight SVG sparkline — no Recharts overhead.
 * Renders a small line chart ~60x24px with no axes.
 */
export const MiniSparkline = memo(function MiniSparkline({
  data,
  width = 60,
  height = 24,
  color = "#10b981",
  fill = false,
}: MiniSparklineProps) {
  if (!data || data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-[9px] text-muted-foreground"
        style={{ width, height }}
      >
        —
      </div>
    )
  }

  const padding = 2
  const w = width - padding * 2
  const h = height - padding * 2

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * w
    const y = padding + h - ((v - min) / range) * h
    return { x, y }
  })

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")

  const fillPath = fill
    ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height - padding} L ${points[0].x.toFixed(1)} ${height - padding} Z`
    : undefined

  return (
    <svg width={width} height={height} className="shrink-0">
      {fill && fillPath && (
        <path d={fillPath} fill={color} opacity={0.15} />
      )}
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* Last point dot */}
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={1.5} fill={color} />
    </svg>
  )
})
