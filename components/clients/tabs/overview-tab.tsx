import { AlertTriangle, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { OverviewPerformance } from "@/components/clients/overview-performance"
import { ReadyBankCard } from "@/components/clients/ready-bank-card"
import { RunwayCapacityWidget } from "@/components/clients/runway-capacity-widget"
import { alertSeverityColor } from "@/lib/design-tokens"
import {
  getClientContactsByRange,
  getClientPerformanceHistory,
  getClientProviderSplit,
} from "@/lib/queries/analytics"
import { getClientRecipientSplit } from "@/lib/queries/portfolio"
import { ProviderSplitCard } from "@/components/clients/provider-split-card"
import { getClientAlerts } from "@/lib/queries/clients"
import { getClientReadyBank } from "@/lib/queries/ready-bank"
import { formatDistanceToNow } from "date-fns"
import { SectionFreshness } from "@/components/shared/section-freshness"
import type { ClientSnapshot } from "@/types/analytics"
import type { ClientConfig } from "@/types/analytics"

interface OverviewTabProps {
  clientSlug: string
  latestSnapshot: ClientSnapshot | null
  config: ClientConfig
  alertCount: number
  /** Custom date range (?from/?to, already format-validated by the page) —
      drives the range-scoped KPIs AND the three-chart suite (Phase 4 picker,
      Phase 5 charts). */
  customFrom?: string
  customTo?: string
}

export async function OverviewTab({
  clientSlug,
  latestSnapshot,
  config,
  alertCount,
  customFrom,
  customTo,
}: OverviewTabProps) {
  // ONE wide history fetch feeds the KPI cards AND all three charts (V2
  // Phase 5) — the range presets + custom picker filter it client-side, so
  // switches are instant. 365 days comfortably covers "All Time" (facts
  // begin 2026-06-09) and any custom range worth charting.
  const [topAlerts, performanceHistory, providerSplit, recipientSplit, readyBank, contactsByRange] =
    await Promise.all([
      getClientAlerts(clientSlug, false, 3),
      getClientPerformanceHistory(clientSlug, 365),
      getClientProviderSplit(clientSlug, 14),
      getClientRecipientSplit(clientSlug, 14),
      getClientReadyBank(clientSlug),
      // V4 A3: distinct contacts precomputed per range preset — the two
      // efficiency ratios need a true COUNT(DISTINCT lead), which the daily
      // history can't provide client-side.
      getClientContactsByRange(clientSlug, customFrom, customTo),
    ])

  return (
    <div className="space-y-6">
      {/* Duplicate all-time KPI row removed (Omar V3 D1/D2): the sticky client
          header already carries all-time Sent / Reply Rate / Mailboxes, and the
          range bar's "All Time" preset reproduces the totals. So there is now
          ONE positive-replies card and ONE total-replies card — both
          range-scoped — and the range bar leads the page (was sandwiched
          between two rows). */}
      <div className="flex justify-end">
        <SectionFreshness factDate={latestSnapshot?.snapshot_date} />
      </div>

      {/* Range-scoped KPIs + the three-chart suite (positive replies → sends
          vs target → reply rate), one range selector driving all. */}
      <OverviewPerformance
        history={performanceHistory}
        config={config}
        customRange={customFrom ? { from: customFrom, to: customTo } : undefined}
        contactsByRange={contactsByRange}
      />

      {/* Provider Performance (sender infrastructure + recipient inbox split) */}
      <ProviderSplitCard rows={providerSplit} days={14} recipient={recipientSplit} />

      {/* Ready Bank — the qualified-lead fuel tank (replaces the old
          lead-pipeline funnel per Omar's 07-06 review) */}
      <ReadyBankCard data={readyBank} />

      {/* Runway & Capacity */}
      <RunwayCapacityWidget snapshot={latestSnapshot} config={config} />

      {/* Top Alerts */}
      {topAlerts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Recent Alerts
              </CardTitle>
              <Link
                href={`/clients/${clientSlug}?tab=alerts`}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View All
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topAlerts.map((alert) => {
                const severityColors = alertSeverityColor(alert.severity)
                return (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${severityColors.bg} ${severityColors.text}`}
                    >
                      {alert.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {alert.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(alert.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
