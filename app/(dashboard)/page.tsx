import { Suspense } from "react"
import { Mail, MessageSquare, MessageCircle, Percent, Bell, Gauge } from "lucide-react"
import { getGlobalKPIs, getClientSummaries, getDailySendHistory, getTodayLive } from "@/lib/queries/analytics"
import { getPortfolioHealth } from "@/lib/queries/portfolio"
import { TodayLiveStrip } from "@/components/shared/today-live-strip"
import { PortfolioHealthStrip } from "@/components/dashboard/portfolio-health-strip"
import { getTopAlerts } from "@/lib/queries/alerts"
import { getRecentSpamRisks } from "@/lib/queries/campaigns"
import { replyRateColor } from "@/lib/design-tokens"
import { MetricCard } from "@/components/shared/metric-card"
import { ClientSummaryGrid } from "@/components/dashboard/client-summary-grid"
import { AlertsBanner } from "@/components/dashboard/alerts-banner"
import { SpamRiskBanner } from "@/components/dashboard/spam-risk-banner"
import { SendTargetChart } from "@/components/dashboard/send-target-chart"
import { SyncStatusWidget } from "@/components/dashboard/sync-status-widget"
import { SectionFreshness } from "@/components/shared/section-freshness"
import { TimeRangeFilter } from "@/components/dashboard/time-range-filter"
import { parseRangeDays } from "@/lib/range-utils"

const RANGE_LABELS: Record<string, string> = {
  "1d": "Today",
  "7d": "Last 7 Days",
  "14d": "Last 14 Days",
  "30d": "Last 30 Days",
}

interface CommandCenterPageProps {
  searchParams: Promise<{ range?: string }>
}

export default async function CommandCenterPage({ searchParams }: CommandCenterPageProps) {
  const params = await searchParams
  const days = parseRangeDays(params.range)
  const rangeKey = params.range ?? "7d"

  const [kpis, summaries, topAlerts, sendHistory, spamRisks, todayLive, portfolio] = await Promise.all([
    getGlobalKPIs(days),
    getClientSummaries(days),
    getTopAlerts(5),
    getDailySendHistory(days),
    getRecentSpamRisks(7, 3),
    getTodayLive(),
    getPortfolioHealth(),
  ])

  const infraByClient = Object.fromEntries(
    portfolio.map((p) => [
      p.client,
      {
        nonRetired: p.non_retired_mailboxes,
        atRisk: p.at_risk_mailboxes,
        listed: p.listed_domains,
      },
    ])
  )

  const liveTotals = todayLive.reduce(
    (acc, r) => ({
      sends: acc.sends + r.sends_today,
      replies: acc.replies + r.replies_today,
      lastEvent:
        !acc.lastEvent || (r.last_send_at && r.last_send_at > acc.lastEvent)
          ? r.last_send_at
          : acc.lastEvent,
    }),
    { sends: 0, replies: 0, lastEvent: null as string | null }
  )

  const replyRateColors = replyRateColor(kpis.overallReplyRate)
  const emailsSentLabel = days === 1 ? "Emails Sent Yesterday" : `Emails Sent (${RANGE_LABELS[rangeKey] ?? `${days}d`})`
  const chartLabel = `Daily Send Volume (${RANGE_LABELS[rangeKey] ?? `${days} days`})`

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Command Center
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of all clients and campaigns
          </p>
          <SectionFreshness live className="mt-1.5" />
        </div>
        <Suspense fallback={null}>
          <TimeRangeFilter />
        </Suspense>
      </div>

      {/* Intraday activity from the live webhook capture */}
      <TodayLiveStrip
        sendsToday={liveTotals.sends}
        repliesToday={liveTotals.replies}
        lastEventAt={liveTotals.lastEvent}
        scopeLabel="all clients"
      />

      {/* Alerts Banner — only renders when alerts exist */}
      <AlertsBanner alerts={topAlerts} />

      {/* Spam Risk Banner — only renders when recent spam issues exist */}
      <SpamRiskBanner risks={spamRisks} />

      {/* KPI Cards with gradient background */}
      <div className="rounded-2xl bg-gradient-to-br from-stone-50 via-white to-stone-100 dark:from-stone-900/50 dark:via-background dark:to-stone-900/30 p-3 sm:p-6 -mx-1 sm:-mx-2">
      <div className="mb-2 flex justify-end">
        <SectionFreshness factDate={kpis.latestSnapshotDate} />
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-6">
        <MetricCard
          title={emailsSentLabel}
          value={kpis.emailsSentYesterday.toLocaleString()}
          icon={Mail}
        />
        <MetricCard
          title="Interested Replies"
          value={kpis.positiveReplies.toLocaleString()}
          icon={MessageSquare}
        />
        <MetricCard
          title="Total Replies"
          value={kpis.totalReplies.toLocaleString()}
          icon={MessageCircle}
        />
        <MetricCard
          title="Overall Reply Rate"
          value={
            kpis.overallReplyRate > 0
              ? `${kpis.overallReplyRate.toFixed(1)}%`
              : "N/A"
          }
          icon={Percent}
          valueColor={replyRateColors.text}
        />
        <MetricCard
          title="Active Alerts"
          value={kpis.activeAlerts}
          icon={Bell}
          valueColor={kpis.activeAlerts > 0 ? "text-rose-600" : undefined}
        />
        <MetricCard
          title="Sending Capacity"
          value={
            kpis.capacityUtilization > 0
              ? `${kpis.capacityUtilization.toFixed(0)}%`
              : "N/A"
          }
          icon={Gauge}
        />
      </div>
      </div>

      {/* Client Summary Grid + portfolio infra roll-up (PORT-2/3) */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Clients</h2>
        <div className="mb-3">
          <PortfolioHealthStrip rows={portfolio} />
        </div>
        <ClientSummaryGrid
          summaries={summaries}
          periodDays={days}
          infraByClient={infraByClient}
        />
      </div>

      {/* Daily Send Target Chart + Sync Status */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1fr_320px]">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {chartLabel}
          </h2>
          <div className="rounded-lg border bg-card p-4">
            <SendTargetChart data={sendHistory} />
          </div>
        </div>
        <div className="lg:mt-9">
          <SyncStatusWidget />
        </div>
      </div>
    </div>
  )
}
