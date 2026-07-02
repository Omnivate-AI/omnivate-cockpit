import { FileText, Copy, AlertTriangle, Mail, MessageSquare, Percent } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getDigestData } from "@/lib/queries/analytics"
import { getTopAlerts } from "@/lib/queries/alerts"
import { getRecentSpamRisks } from "@/lib/queries/campaigns"
import { DigestCopyButton } from "@/components/digest/digest-copy-button"

export default async function DigestPage() {
  const [digest, alerts, spamRisks] = await Promise.all([
    getDigestData(),
    getTopAlerts(5),
    getRecentSpamRisks(7, 5),
  ])

  // Build plain-text digest for clipboard
  const lines: string[] = []
  lines.push(`Daily Digest — ${digest.date}`)
  lines.push("=".repeat(40))
  lines.push("")
  lines.push("SUMMARY")
  lines.push(`  Emails Sent Yesterday: ${digest.totalSent.toLocaleString()}`)
  lines.push(`  Interested Replies: ${digest.totalInterested.toLocaleString()}`)
  lines.push(`  Total Replies: ${digest.totalReplies.toLocaleString()}`)
  lines.push(
    `  Overall Reply Rate: ${digest.overallReplyRate > 0 ? digest.overallReplyRate.toFixed(2) + "%" : "N/A"}`
  )
  lines.push("")
  lines.push("PER CLIENT")
  for (const c of digest.clients) {
    lines.push(
      `  ${c.displayName}: ${c.emailsSent.toLocaleString()} sent, ${c.interestedReplies} interested, ${c.totalReplies} replies, ${c.replyRate > 0 ? c.replyRate.toFixed(2) + "%" : "N/A"} reply rate`
    )
  }

  if (spamRisks.length > 0) {
    lines.push("")
    lines.push("DELIVERABILITY ISSUES")
    for (const r of spamRisks) {
      lines.push(
        `  ${r.campaign_name} (${r.client}): ${(r.spam_pct ?? 0).toFixed(1)}% spam — tested ${r.test_date}`
      )
    }
  }

  if (alerts.length > 0) {
    lines.push("")
    lines.push("ACTIVE ALERTS")
    for (const a of alerts) {
      lines.push(
        `  [${a.severity.toUpperCase()}] ${a.title} — ${a.client} (${a.domain_name})`
      )
    }
  }

  const plainText = lines.join("\n")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Daily Digest
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Summary for {digest.date}
          </p>
        </div>
        <DigestCopyButton text={plainText} />
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                <Mail className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Emails Sent Yesterday</p>
                <p className="text-2xl font-semibold">{digest.totalSent.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <MessageSquare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Interested Replies</p>
                <p className="text-2xl font-semibold">{digest.totalInterested.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Replies</p>
                <p className="text-2xl font-semibold">{digest.totalReplies.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Percent className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overall Reply Rate</p>
                <p className="text-2xl font-semibold">
                  {digest.overallReplyRate > 0 ? `${digest.overallReplyRate.toFixed(2)}%` : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-client breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Per Client Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Client</th>
                  <th className="pb-2 pr-4 font-medium text-right">Sent Yesterday</th>
                  <th className="pb-2 pr-4 font-medium text-right">Interested</th>
                  <th className="pb-2 pr-4 font-medium text-right">Total Replies</th>
                  <th className="pb-2 font-medium text-right">Reply Rate</th>
                </tr>
              </thead>
              <tbody>
                {digest.clients.map((c) => (
                  <tr key={c.client} className="border-b last:border-0">
                    <td className="py-2.5 pr-4 font-medium">{c.displayName}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {c.emailsSent.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {c.interestedReplies.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {c.totalReplies.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {c.replyRate > 0 ? `${c.replyRate.toFixed(2)}%` : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Deliverability Issues */}
      {spamRisks.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Deliverability Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {spamRisks.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium text-sm">{r.campaign_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.client} — tested {r.test_date}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      (r.spam_pct ?? 0) > 20
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}
                  >
                    {(r.spam_pct ?? 0).toFixed(1)}% spam
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Active Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <span
                    className={`flex h-2 w-2 shrink-0 rounded-full ${
                      ["critical", "high"].includes(a.severity)
                        ? "bg-rose-500"
                        : "bg-amber-500"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.client} — {a.domain_name}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      ["critical", "high"].includes(a.severity)
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}
                  >
                    {a.severity}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
