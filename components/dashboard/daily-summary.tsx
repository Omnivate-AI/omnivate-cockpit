import { CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DigestCopyButton } from "@/components/digest/digest-copy-button"
import { buildDigestSummaryText, type DigestClientLine } from "@/lib/digest-text"
import type { ClientSummary, GlobalKPIs } from "@/lib/queries/analytics"
import type { PlacementTestResult } from "@/lib/queries/campaigns"
import type { TopAlert } from "@/lib/queries/alerts"

/**
 * V2 Phase 9 — the merged daily summary that used to live at /digest. It
 * reads the SAME data the Command Center already fetched (KPIs + client
 * summaries + alerts + spam), so headline numbers come from one code path.
 * Renders: a copy-to-clipboard Slack summary + a dense per-client breakdown
 * table, both range-scoped to match the KPI cards above.
 */
export function DailySummary({
  summaries,
  kpis,
  spamRisks,
  alerts,
  rangeLabel,
  asOfLabel,
}: {
  summaries: ClientSummary[]
  kpis: GlobalKPIs
  spamRisks: PlacementTestResult[]
  alerts: TopAlert[]
  rangeLabel: string
  asOfLabel: string | null
}) {
  // Per-client lines from the shared summaries (same numbers as the cards).
  const clientLines: DigestClientLine[] = summaries
    .map((s) => {
      const sent = s.latest?.emails_sent_count ?? 0
      return {
        displayName: s.config.display_name,
        sent,
        positive: s.periodPositives,
        totalReplies: s.periodReplies,
        replyRate: sent > 0 ? (s.periodReplies / sent) * 100 : 0,
        contacts: s.periodContacts,
      }
    })
    .sort((a, b) => b.sent - a.sent)

  // Efficiency metric (V3 Phase 2 C1): distinct contacts to earn one positive
  // reply, range-scoped. null when there are no positives yet. (Emails-per-
  // positive dropped 2026-07-20 — near-redundant with the reply rate.)
  const totalContacts = summaries.reduce((sum, s) => sum + (s.periodContacts ?? 0), 0)
  const contactsPerPositive =
    kpis.positiveReplies > 0 ? totalContacts / kpis.positiveReplies : null

  const text = buildDigestSummaryText({
    rangeLabel,
    asOfLabel,
    totalSent: kpis.emailsSentYesterday,
    totalPositive: kpis.positiveReplies,
    totalReplies: kpis.totalReplies,
    overallReplyRate: kpis.overallReplyRate,
    contactsPerPositive,
    clients: clientLines,
    spamRisks: spamRisks.map((r) => ({
      campaign_name: r.campaign_name,
      client: r.client,
      spam_pct: r.spam_pct,
      test_date: r.test_date,
    })),
    alerts: alerts.map((a) => ({
      severity: a.severity,
      title: a.title,
      client: a.client,
      domain_name: a.domain_name,
    })),
  })

  const allClear = alerts.length === 0 && spamRisks.length === 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Daily Summary</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Per-client breakdown for {rangeLabel} — copy it for Slack
            </p>
          </div>
          <DigestCopyButton text={text} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {clientLines.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No active clients reported for this range.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Client</th>
                  <th className="pb-2 pr-4 font-medium text-right">Sent</th>
                  <th className="pb-2 pr-4 font-medium text-right">Positive</th>
                  <th className="pb-2 pr-4 font-medium text-right">Total Replies</th>
                  <th className="pb-2 pr-4 font-medium text-right">Reply Rate</th>
                  <th
                    className="pb-2 font-medium text-right"
                    title="Distinct people emailed ÷ positive replies in this range"
                  >
                    Contacts / Pos
                  </th>
                </tr>
              </thead>
              <tbody>
                {clientLines.map((c) => {
                  const contactsPerPos =
                    c.positive > 0 && c.contacts != null
                      ? Math.round(c.contacts / c.positive)
                      : null
                  return (
                    <tr key={c.displayName} className="border-b last:border-0">
                      <td className="py-2.5 pr-4 font-medium capitalize">{c.displayName}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{c.sent.toLocaleString()}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                        {c.positive.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{c.totalReplies.toLocaleString()}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">
                        {c.replyRate > 0 ? `${c.replyRate.toFixed(2)}%` : "N/A"}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {contactsPerPos != null ? contactsPerPos.toLocaleString() : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Explicit all-clear — the digest's calm state, kept (answer: absorb it) */}
        {allClear && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            All clear — no deliverability issues and nothing needs action right now.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
