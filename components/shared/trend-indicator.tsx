import { ArrowUp, ArrowDown, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

export interface TrendIndicatorProps {
  current: number
  previous: number
  format?: "number" | "percent" | "days"
  inverted?: boolean
  className?: string
}

function computeDelta(current: number, previous: number): { direction: "up" | "down" | "flat"; pct: number; abs: number } {
  if (previous === 0) {
    if (current === 0) return { direction: "flat", pct: 0, abs: 0 }
    return { direction: "up", pct: 100, abs: current }
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100
  if (Math.abs(pct) < 1) return { direction: "flat", pct: 0, abs: Math.abs(current - previous) }
  return { direction: pct > 0 ? "up" : "down", pct: Math.abs(pct), abs: Math.abs(current - previous) }
}

function formatDelta(delta: { pct: number; abs: number }, format: "number" | "percent" | "days"): string {
  switch (format) {
    case "percent":
      return `${delta.pct >= 10 ? Math.round(delta.pct) : delta.pct.toFixed(1)}%`
    case "days":
      return `${delta.abs}d`
    case "number":
    default:
      return `${delta.pct >= 10 ? Math.round(delta.pct) : delta.pct.toFixed(1)}%`
  }
}

const directionConfig = {
  up: { icon: ArrowUp, goodColor: "text-emerald-600", badColor: "text-rose-600" },
  down: { icon: ArrowDown, goodColor: "text-emerald-600", badColor: "text-rose-600" },
  flat: { icon: ArrowRight, goodColor: "text-muted-foreground", badColor: "text-muted-foreground" },
} as const

export function TrendIndicator({ current, previous, format = "percent", inverted = false, className }: TrendIndicatorProps) {
  const delta = computeDelta(current, previous)
  const config = directionConfig[delta.direction]
  const TrendIcon = config.icon

  let color: string
  if (delta.direction === "flat") {
    color = "text-muted-foreground"
  } else {
    const isGood = inverted ? delta.direction === "down" : delta.direction === "up"
    color = isGood ? config.goodColor : config.badColor
  }

  const sign = delta.direction === "up" ? "+" : delta.direction === "down" ? "-" : ""
  const text = `${sign}${formatDelta(delta, format)}`

  return (
    <div className={cn("flex items-center gap-1 text-xs font-medium", color, className)}>
      <TrendIcon className="h-3 w-3" />
      <span>{text}</span>
    </div>
  )
}
