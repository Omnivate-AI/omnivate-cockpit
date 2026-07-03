import { ShieldCheck } from "lucide-react"
import { getClientAlertData } from "@/lib/queries/alerts"
import { AlertsTable } from "@/components/alerts/alerts-table"
import { EmptyState } from "@/components/shared/empty-state"
import { SectionFreshness } from "@/components/shared/section-freshness"

interface AlertsTabProps {
  clientSlug: string
}

export async function AlertsTab({ clientSlug }: AlertsTabProps) {
  const { unresolved, recentlyResolved, summary } = await getClientAlertData(clientSlug)

  if (unresolved.length === 0 && recentlyResolved.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="All Clear"
        description="No alerts for this client. Everything is running smoothly."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <SectionFreshness mode="db" prefix="Live alerts" />
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm">
        {summary.critical > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 font-medium">
            {summary.critical} critical
          </span>
        )}
        {summary.warning > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 font-medium">
            {summary.warning} warning
          </span>
        )}
        {summary.resolvedThisWeek > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 font-medium">
            {summary.resolvedThisWeek} resolved this week
          </span>
        )}
      </div>

      <AlertsTable
        unresolved={unresolved}
        recentlyResolved={recentlyResolved}
      />
    </div>
  )
}
