import { cn } from "@/lib/utils"

export interface ProgressBarProps {
  value: number
  label?: string
  showValue?: boolean
  thresholds?: { warning: number; critical: number }
  className?: string
}

function getBarColor(value: number, thresholds?: { warning: number; critical: number }): string {
  if (!thresholds) return "bg-emerald-500"
  if (value >= thresholds.warning) return "bg-emerald-500"
  if (value >= thresholds.critical) return "bg-amber-500"
  return "bg-rose-500"
}

export function ProgressBar({ value, label, showValue = true, thresholds, className }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value))
  const barColor = getBarColor(clamped, thresholds)

  return (
    <div className={cn("w-full", className)}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          {label && <span className="font-medium text-muted-foreground">{label}</span>}
          {showValue && <span className="tabular-nums text-muted-foreground">{Math.round(clamped)}%</span>}
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
