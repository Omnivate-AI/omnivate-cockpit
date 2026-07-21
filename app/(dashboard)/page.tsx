import { Suspense } from "react"
import { Mail, MessageSquare, MessageCircle, Percent, Send, Users } from "lucide-react"
import { getGlobalKPIs, getClientSummaries } from "@/lib/queries/analytics"
import { formatRatio } from "@/lib/format"
import { getPortfolioHealth } from "@/lib/queries/portfolio"
import { PortfolioHealthStrip } from "@/components/dashboard/portfolio-health-strip"
import { getTopAlerts } from "@/lib/queries/alerts"
import { getRecentSpamRisks } from "@/lib/queries/campaigns"
import { replyRateColor } from "@/lib/design-tokens"
import { MetricCard } from "@/components/shared/metric-card"
import { ClientSummaryGrid } from "@/components/dashboard/client-summary-grid"
import { DailySummary } from "@/components/dashboard/daily-summary"
import { SpamRiskBanner } from "@/components/dashboard/spam-risk-banner"
import { SectionFreshness } from "@/components/shared/section-freshness"
import { TimeRangeFilter } from "@/components/dashboard/time-range-filter"
import { RangeTransitionProvider, RangeVeil } from "@/components/dashboard/range-transition"
import { parseRangeDays } from "@/lib/range-utils"

const RANGE_LABELS: Record<string, string> = {
  "1d": "Yesterday",
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
  const rangeKey = params.range ?? "1d"

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
  // days=1 = the latest BUSINESS day (weekend-skipping anchor). Label the
  // single-day view with the ACTUAL day — the date on the KPI cards, the
  // weekday NAME on the range toggle + range label — so it reads "Friday", not
  // a misleading "Yesterday", when the data is really Friday's (Omar 2026-07-20).
  const anchorDate = kpis.latestSnapshotDate
    ? new Date(`${kpis.latestSnapshotDate}T00:00:00Z`)
    : null
  const anchorLabel = anchorDate
    ? anchorDate.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      })
    : "Yesterday"
  const anchorWeekday = anchorDate
    ? anchorDate.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" })
    : "Yesterday"
  const rangeLabel =
    days === 1 ? anchorWeekday : RANGE_LABELS[rangeKey] ?? `${days}d`
  const emailsSentLabel =
    days === 1 ? `Emails Sent (${anchorLabel})` : `Emails Sent (${rangeLabel})`
  const replyRateLabel =
    days === 1 ? `Reply Rate (${anchorLabel})` : `Reply Rate (${rangeLabel})`

  // Two efficiency KPIs (V3 Phase 2 B1, emails-per-positive restored in V4 —
  // Omar explicitly wants BOTH, differentiated: 10 emails to 1 person who
  // replies = 10:1 emails/positive but 1:1 contacts/positive. Do not re-drop
  // as "redundant with reply rate"). periodContacts is the distinct-contacts
  // RPC summed across clients; null-guard on 0 positives.
  const totalContacts = summaries.reduce((sum, s) => sum + (s.periodContacts ?? 0), 0)
  const emailsPerPositive =
    kpis.positiveReplies > 0 ? kpis.emailsSentYesterday / kpis.positiveReplies : null
  const contactsPerPositive =
    kpis.positiveReplies > 0 ? totalContacts / kpis.positiveReplies : null
  const fmtEff = formatRatio
  const windowLabel = days === 1 ? anchorLabel : rangeLabel

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
            <TimeRangeFilter oneDayLabel={anchorWeekday} />
          </div>

          {/* Active-alerts banner removed from the Command Center per Omar
              (2026-07-15) — alerts live on the Alerts page + the sidebar badge.
              topAlerts is still fetched for the Daily Summary copy text below. */}

          {/* Spam Risk Banner — only renders when recent spam issues exist */}
          <SpamRiskBanner risks={spamRisks} />

          {/* "Needs Action Today" panel removed from the Command Center per Omar
              (2026-07-20). At-risk/burnt still surface on each client's card
              (infra line) + the Mailboxes tab. */}

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

              {/* Efficiency row (V3 Phase 2 B1) — the two "cost per positive
                  reply" metrics Omar asked for, across all clients, range-scoped. */}
              <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2">
                <MetricCard
                  title="Emails per Positive Reply"
                  value={fmtEff(emailsPerPositive)}
                  icon={Send}
                  subtitle={`Emails sent ÷ positive reply · ${windowLabel}`}
                />
                <MetricCard
                  title="Contacts per Positive Reply"
                  value={fmtEff(contactsPerPositive)}
                  icon={Users}
                  subtitle={`People emailed ÷ positive reply · ${windowLabel}`}
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

          {/* Daily Summary — the merged /digest: per-client breakdown +
              copy-to-clipboard Slack text + all-clear, from the SAME data
              as the KPIs above (V2 Phase 9; /digest now redirects here). */}
          <RangeVeil>
            <DailySummary
              summaries={summaries}
              kpis={kpis}
              spamRisks={spamRisks}
              alerts={topAlerts}
              rangeLabel={rangeLabel}
              asOfLabel={days === 1 ? anchorLabel : (kpis.latestSnapshotDate ? `as of ${anchorLabel}` : null)}
            />
          </RangeVeil>
        </div>
      </RangeTransitionProvider>
    </Suspense>
  )
}
