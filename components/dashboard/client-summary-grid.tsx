import type { ClientSummary } from "@/lib/queries/analytics"
import { ClientSummaryCard, computeHealthStatus } from "./client-summary-card"

interface ClientSummaryGridProps {
  summaries: ClientSummary[]
  periodDays?: number
}

const STATUS_PRIORITY: Record<string, number> = {
  critical: 0,
  warning: 1,
  "no-data": 2,
  healthy: 3,
}

export function ClientSummaryGrid({ summaries, periodDays = 1 }: ClientSummaryGridProps) {
  const sorted = [...summaries].sort((a, b) => {
    const statusA = computeHealthStatus(a.config, a.latest, a.alertCount)
    const statusB = computeHealthStatus(b.config, b.latest, b.alertCount)
    const priorityDiff = (STATUS_PRIORITY[statusA] ?? 3) - (STATUS_PRIORITY[statusB] ?? 3)
    if (priorityDiff !== 0) return priorityDiff
    return a.config.display_name.localeCompare(b.config.display_name)
  })

  if (sorted.length === 0) return null

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {sorted.map((s) => (
        <ClientSummaryCard
          key={s.config.client}
          config={s.config}
          latest={s.latest}
          alertCount={s.alertCount}
          periodDays={periodDays}
        />
      ))}
    </div>
  )
}
