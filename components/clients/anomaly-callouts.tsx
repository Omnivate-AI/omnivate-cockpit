import { AlertTriangle, TrendingDown, Target } from "lucide-react"
import { alertSeverityColor } from "@/lib/design-tokens"
import { cn } from "@/lib/utils"
import type { Anomaly, AnomalyType } from "@/lib/scoring/anomaly-detection"

const ANOMALY_ICONS: Record<AnomalyType, React.ElementType> = {
  SEND_DROP: TrendingDown,
  REPLY_RATE_DROP: TrendingDown,
  SEND_BELOW_TARGET: Target,
}

interface AnomalyCalloutsProps {
  anomalies: Anomaly[]
}

export function AnomalyCallouts({ anomalies }: AnomalyCalloutsProps) {
  if (anomalies.length === 0) return null

  return (
    <div className="space-y-3">
      {anomalies.map((anomaly) => {
        const colors = alertSeverityColor(anomaly.severity)
        const Icon = ANOMALY_ICONS[anomaly.type] ?? AlertTriangle

        return (
          <div
            key={`${anomaly.type}-${anomaly.date}`}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-4",
              colors.bg,
              colors.border
            )}
          >
            <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", colors.text)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className={cn("text-sm font-semibold", colors.text)}>
                  {anomaly.title}
                </h4>
                <span className="text-xs text-muted-foreground">
                  {anomaly.date}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {anomaly.description}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
