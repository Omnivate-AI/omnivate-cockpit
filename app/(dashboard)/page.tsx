import { Suspense } from "react"
import { Mail, MessageSquare, MessageCircle, Percent } from "lucide-react"
import { getGlobalKPIs, getClientSummaries } from "@/lib/queries/analytics"
import { getPortfolioHealth } from "@/lib/queries/portfolio"
import { PortfolioHealthStrip } from "@/components/dashboard/portfolio-health-strip"
import { getTopAlerts } from "@/lib/queries/alerts"
import { getRecentSpamRisks } from "@/lib/queries/campaigns"
import { replyRateColor } from "@/lib/design-tokens"
import { MetricCard } from "@/components/shared/metric-card"
import { ClientSummaryGrid } from "@/components/dashboard/client-summary-grid"
import { AlertsBanner } from "@/components/dashboard/alerts-banner"
import { SpamRiskBanner } from "@/components/dashboard/spam-risk-banner"
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

  const [kpis, summaries, topAlerts, spamRisks, portfolio] = await Promise.all([
    getGlobalKPIs(days),
    getClientSummaries(days),
    getTopAlerts(5),
    getRecentSpamRisks(7, 3),
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

  const replyRateColors = replyRateColor(kpis.overallReplyRate)
  const rangeLabel = RANGE_LABELS[rangeKey] ?? `${days}d`
  const emailsSentLabel = days === 1 ? "Emails Sent Yesterday" : `Emails Sent (${rangeLabel})`
  const replyRateLabel = days === 1 ? "Reply Rate Yesterday" : `Reply Rate (${rangeLabel})`

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
          <SectionFreshness live synced className="mt-1.5" />
        </div>
        <Suspense fallback={null}>
          <TimeRangeFilter />
        </Suspense>
      </div>

      {/* Alerts Banner — only renders when alerts exist */}
      <AlertsBanner alerts={topAlerts} />

      {/* Spam Risk Banner — only renders when recent spam issues exist */}
      <SpamRiskBanner risks={spamRisks} />

      {/* KPI Cards with gradient background */}
      <div className="rounded-2xl bg-gradient-to-br from-stone-50 via-white to-stone-100 dark:from-stone-900/50 dark:via-background dark:to-stone-900/30 p-3 sm:p-6 -mx-1 sm:-mx-2">
      <div className="mb-2 flex justify-end">
        <SectionFreshness factDate={kpis.latestSnapshotDate} />
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
          title={replyRateLabel}
          value={
            kpis.overallReplyRate > 0
              ? `${kpis.overallReplyRate.toFixed(1)}%`
              : "N/A"
          }
          icon={Percent}
          valueColor={replyRateColors.text}
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
    </div>
  )
}
