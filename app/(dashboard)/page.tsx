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
import { RangeTransitionProvider, RangeVeil } from "@/components/dashboard/range-transition"
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
  // days=1 = the latest BUSINESS day with facts (RC-3: facts are weekday-only,
  // so "Yesterday" on a Sun/Mon used to read all zeros) — label it with the
  // actual date so Monday honestly says "Fri, Jul 10" instead of claiming
  // yesterday.
  const anchorLabel = kpis.latestSnapshotDate
    ? new Date(`${kpis.latestSnapshotDate}T00:00:00Z`).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      })
    : "Yesterday"
  const emailsSentLabel =
    days === 1 ? `Emails Sent (${anchorLabel})` : `Emails Sent (${rangeLabel})`
  const replyRateLabel =
    days === 1 ? `Reply Rate (${anchorLabel})` : `Reply Rate (${rangeLabel})`

  return (
    // Suspense: the transition provider reads useSearchParams (CSR bailout
    // requires a boundary). It wraps the filter AND the veiled regions so a
    // range click presses instantly and dims exactly the data it re-scopes.
    <Suspense fallback={null}>
      <RangeTransitionProvider>
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
            <TimeRangeFilter />
          </div>

          {/* Alerts Banner — only renders when alerts exist */}
          <AlertsBanner alerts={topAlerts} />

          {/* Spam Risk Banner — only renders when recent spam issues exist */}
          <SpamRiskBanner risks={spamRisks} />

          {/* KPI Cards with gradient background — range-scoped, veiled while switching */}
          <RangeVeil>
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
                  title="Positive Replies"
                  value={kpis.positiveReplies.toLocaleString()}
                  icon={MessageSquare}
                  subtitle="Interested + human-action-required"
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
          </RangeVeil>

          {/* Client Summary Grid + portfolio infra roll-up (PORT-2/3) */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-foreground">Clients</h2>
            <div className="mb-3">
              <PortfolioHealthStrip rows={portfolio} />
            </div>
            <RangeVeil>
              <ClientSummaryGrid
                summaries={summaries}
                periodDays={days}
                infraByClient={infraByClient}
              />
            </RangeVeil>
          </div>
        </div>
      </RangeTransitionProvider>
    </Suspense>
  )
}
