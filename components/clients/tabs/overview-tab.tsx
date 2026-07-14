import { Mail, ThumbsUp, MessageCircle, Percent, AlertTriangle, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricCard } from "@/components/shared/metric-card"
import { MiniSendChart } from "@/components/clients/mini-send-chart"
import { SendReplyChart } from "@/components/clients/send-reply-chart"
import { RepliesChart } from "@/components/clients/replies-chart"
import { PerformanceMetrics } from "@/components/clients/performance-metrics"
import { ReadyBankCard } from "@/components/clients/ready-bank-card"
import { RunwayCapacityWidget } from "@/components/clients/runway-capacity-widget"
import { replyRateColor, alertSeverityColor } from "@/lib/design-tokens"
import { getClientRecentHistory, getClientSendReplyHistory, getClientReplyHistory, getClientPerformanceHistory, getClientProviderSplit } from "@/lib/queries/analytics"
import { getClientRecipientSplit } from "@/lib/queries/portfolio"
import { ProviderSplitCard } from "@/components/clients/provider-split-card"
import { getClientAlerts } from "@/lib/queries/clients"
import { getClientReadyBank } from "@/lib/queries/ready-bank"
import { getClientTotalReplies } from "@/lib/queries/campaigns"
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
      drives the performance-metrics KPIs (Phase 4); the chart suite follows
      in Phase 5's rebuild. */
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
  // A custom range may reach further back than the default 60-day history
  // window — widen the fetch to cover it (capped at a year).
  let historyDays = 60
  if (customFrom) {
    const from = new Date(`${customFrom}T00:00:00Z`)
    const days = Math.ceil((Date.now() - from.getTime()) / 86_400_000) + 1
    historyDays = Math.min(365, Math.max(60, days))
  }

  const [history, sendReplyHistory, topAlerts, totalReplies, replyData, performanceHistory, providerSplit, recipientSplit, readyBank] = await Promise.all([
    getClientRecentHistory(clientSlug, 7),
    getClientSendReplyHistory(clientSlug, 14),
    getClientAlerts(clientSlug, false, 3),
    getClientTotalReplies(clientSlug),
    getClientReplyHistory(clientSlug, 30),
    getClientPerformanceHistory(clientSlug, historyDays),
    getClientProviderSplit(clientSlug, 14),
    getClientRecipientSplit(clientSlug, 14),
    getClientReadyBank(clientSlug),
  ])

  const emailsSent = latestSnapshot?.emails_sent_count ?? null
  const positiveReplies = latestSnapshot?.positive_replies_count ?? null
  const allTimeSent = latestSnapshot?.all_time_emails_sent ?? 0
  // Reply rate = TOTAL replies ÷ sent, all-time, labeled as such (RC-4 —
  // this card previously computed all-time INTERESTED ÷ sent, the same
  // ~0.1% formula Omar rejected on the Command Center).
  const allTimeReplies = latestSnapshot?.all_time_replies ?? totalReplies
  const replyRate = allTimeSent > 0 ? (allTimeReplies / allTimeSent) * 100 : null
  const replyRateDisplay = replyRate !== null ? `${replyRate.toFixed(1)}%` : "No Data"
  const replyRateColors = replyRate !== null ? replyRateColor(replyRate) : null
  // Latest business day, shown in the card labels (facts are weekday-only,
  // so "Yesterday" would lie on Sun/Mon — RC-3)
  const factDayLabel = latestSnapshot?.snapshot_date
    ? new Date(`${latestSnapshot.snapshot_date}T00:00:00Z`).toLocaleDateString(
        "en-GB",
        { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }
      )
    : "latest day"

  return (
    <div className="space-y-6">
      {/* Performance Metrics with Time Range Toggles */}
      <PerformanceMetrics
        history={performanceHistory}
        customRange={customFrom ? { from: customFrom, to: customTo } : undefined}
      />

      {/* KPI Cards */}
      <div className="flex justify-end mb-1">
        <SectionFreshness factDate={latestSnapshot?.snapshot_date} />
      </div>
      {/* Mailbox summary card removed — the Mailboxes tab owns that story (V2 Phase 1) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title={`Emails Sent (${factDayLabel})`}
          value={emailsSent !== null ? emailsSent.toLocaleString() : "No Data"}
          icon={Mail}
        />
        <MetricCard
          title={`Positive Replies (${factDayLabel})`}
          value={positiveReplies !== null ? positiveReplies.toLocaleString() : "No Data"}
          icon={ThumbsUp}
          subtitle="Interested + human-action-required"
        />
        <MetricCard
          title="Total Replies (all-time)"
          value={totalReplies.toLocaleString()}
          icon={MessageCircle}
        />
        <MetricCard
          title="Reply Rate (all-time)"
          value={replyRateDisplay}
          icon={Percent}
          valueColor={replyRateColors?.text}
          subtitle="Total replies ÷ emails sent"
        />
      </div>

      {/* Mini Send Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            Sends — Last 7 Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MiniSendChart
            data={history}
            dailyTarget={config.daily_email_target ?? 0}
          />
        </CardContent>
      </Card>

      {/* Send Volume + Reply Rate Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            Sends &amp; Reply Rate — Last 14 Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SendReplyChart
            data={sendReplyHistory}
            dailyTarget={config.daily_email_target ?? 0}
          />
        </CardContent>
      </Card>

      {/* Positive Replies Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            Replies — Last 30 Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RepliesChart
            data={replyData.history}
            totalInterested={replyData.totalInterested}
          />
        </CardContent>
      </Card>

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
