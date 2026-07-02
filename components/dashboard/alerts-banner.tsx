import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import type { TopAlert } from "@/lib/queries/alerts"

interface AlertsBannerProps {
  alerts: TopAlert[]
}

export function AlertsBanner({ alerts }: AlertsBannerProps) {
  if (alerts.length === 0) return null

  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-950/30">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-rose-600" />
        <span className="text-sm font-semibold text-rose-700 dark:text-rose-400">
          Active Alerts ({alerts.length})
        </span>
      </div>
      <ul className="space-y-2">
        {alerts.map((alert) => {
          const isCritical = alert.severity === "critical"
          return (
            <li key={alert.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    isCritical
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                  }`}
                >
                  {alert.severity}
                </span>
                <span className="font-medium text-foreground truncate">
                  {alert.client}
                </span>
                <span className="text-muted-foreground truncate">
                  {alert.title}
                </span>
              </div>
              <Link
                href={`/clients/${alert.client}?tab=alerts`}
                className="shrink-0 text-xs font-medium text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300"
              >
                View
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
