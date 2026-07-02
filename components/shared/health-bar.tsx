import { cn } from "@/lib/utils"

export function HealthBar({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="text-sm text-muted-foreground">N/A</span>
  }

  const color =
    value >= 95
      ? "bg-emerald-500"
      : value >= 85
        ? "bg-amber-500"
        : "bg-rose-500"

  const textColor =
    value >= 95
      ? "text-emerald-600"
      : value >= 85
        ? "text-amber-600"
        : "text-rose-600"

  return (
    <div className="flex items-center gap-2">
      <div className="w-12 h-1.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
        <div
          className={cn("h-full rounded-full", color)}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className={cn("text-sm tabular-nums font-medium", textColor)}>
        {value.toFixed(0)}%
      </span>
    </div>
  )
}
