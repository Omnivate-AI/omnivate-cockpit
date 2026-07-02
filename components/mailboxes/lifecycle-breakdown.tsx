import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { ClientCapacityRow } from "@/lib/queries/mailboxes"

interface LifecycleBreakdownProps {
  data: ClientCapacityRow
}

interface Segment {
  label: string
  count: number
  color: string
  barColor: string
}

export function LifecycleBreakdown({ data }: LifecycleBreakdownProps) {
  // sp_* lifecycle vocabulary: active/resting (1-week rotation), reserve,
  // warming, parked, burnt, retired. (ramping/draining don't exist anymore.)
  const segments: Segment[] = [
    { label: "Active",  count: data.active,  color: "text-emerald-600", barColor: "bg-emerald-500" },
    { label: "Resting", count: data.resting, color: "text-teal-600",    barColor: "bg-teal-500" },
    { label: "Reserve", count: data.reserve, color: "text-amber-600",   barColor: "bg-amber-500" },
    { label: "Warming", count: data.warming, color: "text-sky-600",     barColor: "bg-sky-500" },
    { label: "Parked",  count: data.parked,  color: "text-zinc-500",    barColor: "bg-zinc-400" },
    { label: "Burnt",   count: data.burnt,   color: "text-rose-600",    barColor: "bg-rose-500" },
    { label: "Retired", count: data.retired, color: "text-gray-500",    barColor: "bg-gray-400" },
  ]
  const total = segments.reduce((s, x) => s + x.count, 0) || 1

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

        {/* Legend */}
        <div className="mt-3 grid grid-cols-4 gap-x-3 gap-y-1 sm:grid-cols-7">
          {segments.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 text-xs">
              <span className={cn("h-2 w-2 rounded-full", s.barColor)} />
              <span className="text-muted-foreground">{s.label}</span>
              <span className={cn("ml-auto font-semibold tabular-nums", s.color)}>{s.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
