import { AlertTriangle, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getAlertList,
  getGlobalAlertSummary,
  getDistinctAlertTypes,
  getActiveClients,
} from "@/lib/queries"
import { AlertFilters } from "@/components/alerts/alert-filters"
import { AlertsTable } from "@/components/alerts/alerts-table"
import { alertTone } from "@/lib/alerts-presentation"
import { cn } from "@/lib/utils"
import { SectionFreshness } from "@/components/shared/section-freshness"
import { Pagination } from "@/components/shared/pagination"
import { MetricCard } from "@/components/shared/metric-card"

const PAGE_SIZE = 25

interface AlertsPageProps {
  searchParams: Promise<{
    severity?: string
    client?: string
    status?: string
    alert_type?: string
    tier?: string
    page?: string
  }>
}

export default async function AlertsPage({ searchParams }: AlertsPageProps) {
  const params = await searchParams

  const severity =
    params.severity === "critical" || params.severity === "warning"
      ? params.severity
      : null
  const client = params.client || null
  const alertType = params.alert_type || null
  const isResolved = params.status === "resolved"
  // Default view = ACTIONABLE only (Omar 07-06 alert rebuild). Maintenance
  // noise is reachable via the tier filter, never the default.
  const tier =
    params.tier === "maintenance"
      ? "maintenance"
      : params.tier === "all"
        ? null
        : "actionable"
  const page = Number(params.page ?? "1")

  const [unresolvedResult, resolvedResult, summary, alertTypes, clients] =
    await Promise.all([
      getAlertList({
        severity,
        client,
        alertType,
        tier,
        resolved: false,
        page: isResolved ? 1 : page,
        pageSize: isResolved ? 25 : PAGE_SIZE,
      }),
      getAlertList({
        severity,
        client,
        alertType,
        tier,
        resolved: true,
        page: isResolved ? page : 1,
        pageSize: isResolved ? PAGE_SIZE : 25,
      }),
      getGlobalAlertSummary(tier),
      getDistinctAlertTypes(),
      getActiveClients(),
    ])

  const activeResult = isResolved ? resolvedResult : unresolvedResult

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Alerts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor and manage deliverability alerts across your infrastructure
        </p>
        <SectionFreshness mode="db" prefix="Live alerts" className="mt-1.5" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          title="Critical"
          value={summary.critical}
          icon={AlertTriangle}
          valueColor={summary.critical > 0 ? "text-rose-600" : "text-foreground"}
        />
        <MetricCard
          title="Warning"
          value={summary.warning}
          icon={AlertCircle}
          valueColor={summary.warning > 0 ? "text-amber-600" : "text-foreground"}
        />
        <MetricCard
          title="Resolved This Week"
          value={summary.resolvedThisWeek}
          icon={CheckCircle2}
          valueColor="text-emerald-600"
        />
      </div>

      {/* Filters */}
      <AlertFilters clients={clients} alertTypes={alertTypes} />

      {/* Alerts Content */}
      {isResolved ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Resolved Alerts</CardTitle>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-stone-100 dark:bg-accent px-1.5 text-xs font-medium text-muted-foreground">
                {resolvedResult.totalCount}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {resolvedResult.alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <ShieldCheck className="h-10 w-10 mb-3 text-emerald-500" />
                <p className="text-sm font-medium">No resolved alerts found</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Severity</th>
                      <th className="px-4 py-3 text-left font-medium">Client</th>
                      <th className="px-4 py-3 text-left font-medium">Title</th>
                      <th className="px-4 py-3 text-left font-medium">Description</th>
                      <th className="px-4 py-3 text-left font-medium">Action Taken</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resolvedResult.alerts.map((alert) => (
                      <tr key={alert.id} className="border-b last:border-0 opacity-60">
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                              alertTone(alert.severity, alert.tier).badge
                            )}
                          >
                            {alert.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">{alert.client}</td>
                        <td className="px-4 py-3">{alert.title}</td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[250px]">
                          {alert.description ? (
                            <span className="line-clamp-1">{alert.description}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {alert.resolved_by || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <AlertsTable
          unresolved={unresolvedResult.alerts}
          recentlyResolved={resolvedResult.alerts}
        />
      )}

      {/* Pagination */}
      {activeResult.totalCount > PAGE_SIZE && (
        <Pagination
          totalCount={activeResult.totalCount}
          pageSize={PAGE_SIZE}
          basePath="/alerts"
        />
      )}
    </div>
  )
}
