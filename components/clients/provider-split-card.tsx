import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Server, AlertTriangle } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { replyRateColor } from "@/lib/design-tokens"
import type { ProviderSplitRow } from "@/lib/queries/analytics"
import type { RecipientProviderRow } from "@/lib/queries/portfolio"

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
  /** Sends/replies BY RECIPIENT inbox provider (send split filled from the
   *  live event capture × MX cache). The deliverability tell: sends INTO a
   *  provider with no replies back suggests the spam folder. */
  recipient?: RecipientProviderRow[]
  /** Last day the window covers (the facts anchor) — printed so the range is
      stated, not guessed (V4 C1: "what range is this — this week? last week?"). */
  windowEnd?: string | null
}

/**
 * Sends/replies segmented by SENDER mailbox provider (provider_canonical),
 * plus the recipient-inbox panel (MX-classified). The Outlook-silent-drop
 * detector: a provider with pool share but no sends, or recipient sends
 * with a collapsed reply rate, stands out immediately.
 */
export function ProviderSplitCard({ rows, days, recipient, windowEnd }: ProviderSplitCardProps) {
  const totalSent = rows.reduce((s, r) => s + r.sent, 0)
  const windowEndLabel = windowEnd
    ? format(new Date(`${windowEnd}T00:00:00`), "EEE d MMM")
    : null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          Provider Performance — Last {days} Days
          {windowEndLabel ? ` ending ${windowEndLabel}` : ""}
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

            {recipient && recipient.some((r) => r.sent > 0 || r.replies > 0) && (
              <RecipientPanel rows={recipient} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Recipient-inbox performance: are the people we email in Google or
 * Microsoft inboxes, and do they reply at comparable rates? A provider
 * receiving meaningful volume with zero replies is flagged — the classic
 * silently-spammed signature.
 */
function RecipientPanel({ rows }: { rows: RecipientProviderRow[] }) {
  const totalSent = rows.reduce((s, r) => s + r.sent, 0)
  const flagged = rows.filter((r) => r.sent >= 100 && r.replies === 0)

  return (
    <div className="border-t pt-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        By recipient inbox provider
      </p>
      {/* E4 (Omar V3): this panel is the PROSPECTS' mail hosts, not our sending
          infra — "Other" here is self-hosted / non-Google-or-Microsoft domains,
          NOT SMTP sending (we send only from Google + Microsoft mailboxes). */}
      <p className="mb-2 text-[11px] text-muted-foreground">
        Where the people we email receive mail (their MX) — not how we send.
        &quot;Other&quot; = self-hosted or non-Google/Microsoft domains.
      </p>
      <div className="space-y-3">
        {rows.map((r) => {
          const share = totalSent > 0 ? (r.sent / totalSent) * 100 : 0
          const rateColors = replyRateColor(r.replyRate)
          return (
            <div key={r.provider}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">
                  {r.provider === "other"
                    ? "Other domains"
                    : PROVIDER_LABELS[r.provider] ?? r.provider}
                </span>
                <span className="flex items-baseline gap-3 tabular-nums">
                  <span>
                    {r.sent.toLocaleString()}{" "}
                    <span className="text-xs text-muted-foreground">sent to</span>
                  </span>
                  <span>
                    {r.replies.toLocaleString()}{" "}
                    <span className="text-xs text-muted-foreground">replies</span>
                  </span>
                  <span
                    className={cn(
                      "font-semibold",
                      r.sent > 0 ? rateColors.text : "text-muted-foreground"
                    )}
                  >
                    {r.sent > 0 ? `${r.replyRate.toFixed(1)}%` : "—"}
                  </span>
                </span>
              </div>
              <div className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    PROVIDER_COLORS[r.provider] ?? "bg-stone-400"
                  )}
                  style={{ width: `${share}%` }}
                  title={`${share.toFixed(0)}% of classified sends`}
                />
              </div>
            </div>
          )
        })}
      </div>
      {flagged.length > 0 && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-rose-700 dark:text-rose-400">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            {flagged
              .map(
                (r) =>
                  `${r.sent.toLocaleString()} emails reached ${PROVIDER_LABELS[r.provider] ?? r.provider} inboxes with zero replies`
              )
              .join("; ")}{" "}
            — possible spam-folder placement.
          </span>
        </p>
      )}
    </div>
  )
}
