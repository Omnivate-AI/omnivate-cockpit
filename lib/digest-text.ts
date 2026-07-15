// V2 Phase 9 — the copy-to-clipboard daily summary, built from the SAME data
// the Command Center already renders (getGlobalKPIs + getClientSummaries +
// alerts + spam), so there is one code path, not a separate getDigestData.
// Same plain-text shape the old /digest produced — it's genuinely useful to
// paste into Slack.

export interface DigestClientLine {
  displayName: string
  sent: number
  positive: number
  totalReplies: number
  replyRate: number
}

export interface DigestTextInput {
  rangeLabel: string
  /** e.g. "as of Fri, 11 Jul" — the latest business day with facts. */
  asOfLabel: string | null
  totalSent: number
  totalPositive: number
  totalReplies: number
  overallReplyRate: number
  clients: DigestClientLine[]
  spamRisks: { campaign_name: string; client: string; spam_pct: number | null; test_date: string }[]
  alerts: { severity: string; title: string; client: string; domain_name: string }[]
}

export function buildDigestSummaryText(d: DigestTextInput): string {
  const lines: string[] = []
  const pct = (v: number) => (v > 0 ? `${v.toFixed(2)}%` : "N/A")

  lines.push(`Summary — ${d.rangeLabel}${d.asOfLabel ? ` (${d.asOfLabel})` : ""}`)
  lines.push("=".repeat(40))
  lines.push("")
  lines.push("SUMMARY")
  lines.push(`  Emails Sent: ${d.totalSent.toLocaleString()}`)
  lines.push(`  Positive Replies: ${d.totalPositive.toLocaleString()} (Interested + human-action-required)`)
  lines.push(`  Total Replies: ${d.totalReplies.toLocaleString()}`)
  lines.push(`  Overall Reply Rate: ${pct(d.overallReplyRate)}`)
  lines.push("")
  lines.push("PER CLIENT")
  if (d.clients.length === 0) {
    lines.push("  No active clients reported for this range.")
  }
  for (const c of d.clients) {
    lines.push(
      `  ${c.displayName}: ${c.sent.toLocaleString()} sent, ${c.positive} positive, ${c.totalReplies} replies, ${pct(c.replyRate)} reply rate`
    )
  }

  lines.push("")
  lines.push("DELIVERABILITY ISSUES")
  if (d.spamRisks.length === 0) {
    lines.push("  None — recent placement tests are clean.")
  }
  for (const r of d.spamRisks) {
    lines.push(
      `  ${r.campaign_name} (${r.client}): ${(r.spam_pct ?? 0).toFixed(1)}% spam — tested ${r.test_date}`
    )
  }

  lines.push("")
  lines.push("ACTIVE ALERTS (needs action)")
  if (d.alerts.length === 0) {
    lines.push("  None — nothing needs action.")
  }
  for (const a of d.alerts) {
    lines.push(
      `  [${a.severity.toUpperCase()}] ${a.title} — ${a.client}${a.domain_name && a.domain_name !== "—" ? ` (${a.domain_name})` : ""}`
    )
  }

  return lines.join("\n")
}
