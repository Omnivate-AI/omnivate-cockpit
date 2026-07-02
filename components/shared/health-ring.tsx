"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ClientHealthBreakdown } from "@/lib/scoring/client-health"

interface HealthRingProps {
  score: number // 0-100
  breakdown?: ClientHealthBreakdown[]
  size?: number // px, default 64
}

function ringColor(score: number): string {
  if (score >= 80) return "#10b981" // emerald-500
  if (score >= 50) return "#f59e0b" // amber-500
  return "#ef4444" // red-500
}

export function HealthRing({ score, breakdown, size = 64 }: HealthRingProps) {
  const strokeWidth = 5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(Math.max(score, 0), 100)
  const offset = circumference - (progress / 100) * circumference
  const color = ringColor(score)

  const ring = (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
    >
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/20"
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-[stroke-dashoffset] duration-700"
      />
      {/* Center score text */}
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground"
        style={{ fontSize: size * 0.28, fontWeight: 600 }}
      >
        {score}
      </text>
    </svg>
  )

  if (!breakdown || breakdown.length === 0) {
    return ring
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{ring}</TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs space-y-1 p-3">
          <p className="font-semibold mb-1.5">Health Breakdown</p>
          {breakdown.map((b) => (
            <div key={b.label} className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{b.label}</span>
              <span className="tabular-nums font-medium">
                {b.score}/{b.maxScore}
              </span>
            </div>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
