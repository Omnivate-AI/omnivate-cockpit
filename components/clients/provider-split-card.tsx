import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Server } from "lucide-react"
import { cn } from "@/lib/utils"
import { replyRateColor } from "@/lib/design-tokens"
import type { ProviderSplitRow } from "@/lib/queries/analytics"

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  microsoft: "Microsoft",
  smtp: "SMTP",
  other: "Other",
}

const PROVIDER_COLORS: Record<string, string> = {
  google: "bg-emerald-500",
  microsoft: "bg-sky-500",
  smtp: "bg-violet-500",
  other: "bg-stone-400",
}

interface ProviderSplitCardProps {
  rows: ProviderSplitRow[]
  days: number
}

/**
 * Sends/replies segmented by SENDER mailbox provider (provider_canonical),
 * plus the recipient-provider reply split (MX-classified at sync time).
 * The Outlook-silent-drop detector: a provider with pool share but no sends
 * or a collapsed reply rate stands out immediately.
 */
export function ProviderSplitCard({ rows, days }: ProviderSplitCardProps) {
  const totalSent = rows.reduce((s, r) => s + r.sent, 0)
  const recipientTotals = rows.reduce(
    (acc, r) => ({
      google: acc.google + r.repliesFromGoogle,
      microsoft: acc.microsoft + r.repliesFromMicrosoft,
      other: acc.other + r.repliesFromOther,
    }),
    { google: 0, microsoft: 0, other: 0 }
  )

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          Provider Performance — Last {days} Days
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          By sender mailbox provider
        </p>
      </CardHeader>
      <CardContent>
        {totalSent === 0 && rows.every((r) => r.replies === 0) ? (
          <p className="py-4 text-sm text-muted-foreground">
            No sends recorded in this window.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const share = totalSent > 0 ? (r.sent / totalSent) * 100 : 0
              const rateColors = replyRateColor(r.replyRate)
              return (
                <div key={r.provider}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">
                      {PROVIDER_LABELS[r.provider] ?? r.provider}
                    </span>
                    <span className="flex items-baseline gap-3 tabular-nums">
                      <span>
                        {r.sent.toLocaleString()}{" "}
                        <span className="text-xs text-muted-foreground">sent</span>
                      </span>
                      <span>
                        {r.replies.toLocaleString()}{" "}
                        <span className="text-xs text-muted-foreground">replies</span>
                      </span>
                      <span className={cn("font-semibold", r.sent > 0 ? rateColors.text : "text-muted-foreground")}>
                        {r.sent > 0 ? `${r.replyRate.toFixed(1)}%` : "—"}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", PROVIDER_COLORS[r.provider] ?? "bg-stone-400")}
                      style={{ width: `${share}%` }}
                      title={`${share.toFixed(0)}% of sends`}
                    />
                  </div>
                  {r.sent === 0 && (
                    <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                      No sends from {PROVIDER_LABELS[r.provider] ?? r.provider} mailboxes in this window
                    </p>
                  )}
                </div>
              )
            })}

            {(recipientTotals.google > 0 ||
              recipientTotals.microsoft > 0 ||
              recipientTotals.other > 0) && (
              <p className="border-t pt-2 text-xs text-muted-foreground">
                Replies by recipient provider:{" "}
                <span className="tabular-nums">
                  Google {recipientTotals.google.toLocaleString()} · Microsoft{" "}
                  {recipientTotals.microsoft.toLocaleString()} · Other{" "}
                  {recipientTotals.other.toLocaleString()}
                </span>
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
