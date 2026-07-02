import { type LucideIcon, ArrowUp, ArrowDown, ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface MetricCardTrend {
  direction: "up" | "down" | "flat"
  value: string
  color?: string
}

export interface MetricCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  valueColor?: string
  trend?: MetricCardTrend
}

const trendConfig = {
  up: { icon: ArrowUp, defaultColor: "text-emerald-600" },
  down: { icon: ArrowDown, defaultColor: "text-rose-600" },
  flat: { icon: ArrowRight, defaultColor: "text-muted-foreground" },
} as const

export function MetricCard({ title, value, icon: Icon, valueColor, trend }: MetricCardProps) {
  return (
    <Card className="backdrop-blur-sm bg-white/80 dark:bg-card/80 ring-1 ring-black/5 dark:ring-white/10 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p
              className={cn(
                "mt-2 text-3xl font-bold tabular-nums",
                valueColor ?? "text-foreground"
              )}
            >
              {value}
            </p>
            {trend && <TrendBadge trend={trend} />}
          </div>
          <div className="rounded-lg bg-stone-100 dark:bg-accent p-2.5">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TrendBadge({ trend }: { trend: MetricCardTrend }) {
  const config = trendConfig[trend.direction]
  const TrendIcon = config.icon
  const color = trend.color ?? config.defaultColor

  return (
    <div className={cn("mt-1 flex items-center gap-1 text-xs font-medium", color)}>
      <TrendIcon className="h-3 w-3" />
      <span>{trend.value}</span>
    </div>
  )
}
