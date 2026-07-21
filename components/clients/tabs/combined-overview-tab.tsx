import Link from "next/link"
import { format } from "date-fns"
import { ArrowRight, Linkedin, Mail, PauseCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SectionFreshness } from "@/components/shared/section-freshness"
import { getClientPerformanceHistory } from "@/lib/queries/analytics"
import { getClientEmailLifetime, getClientLinkedIn } from "@/lib/queries/linkedin"
import type { ClientSnapshot } from "@/types/analytics"

/**
 * V5 — the new combined Overview (Omar: "this overview becomes email, we have
 * a new tab which is LinkedIn, and then we have a new overview which maybe
 * contains both… keep email and LinkedIn fairly separate, then maybe we have
 * like a total"). One card per channel with ITS OWN window stated, deep links
 * into each channel tab, and an all-time combined line — the only place the
 * two channels are summed, because it's the only place the windows match
 * (the V5 Phase-1 lesson: never compare numbers across unlike windows).
 */

export async function CombinedOverviewTab({
  clientSlug,
  latestSnapshot,
}: {
  clientSlug: string
  latestSnapshot: ClientSnapshot | null
}) {
  const [weekHistory, emailLifetime, linkedin] = await Promise.all([
    getClientPerformanceHistory(clientSlug, 7),
    getClientEmailLifetime(clientSlug),
    getClientLinkedIn(clientSlug),
  ])

  const week = weekHistory.reduce(
    (acc, p) => {
      acc.sent += p.emailsSent
      acc.positives += p.positiveReplies
      acc.replies += p.totalReplies
      return acc
    },
    { sent: 0, positives: 0, replies: 0 }
  )

  const liSnapshotLabel = linkedin?.snapshotDate
    ? format(new Date(`${linkedin.snapshotDate}T00:00:00`), "d MMM")
    : null

  const combinedPositives =
    (emailLifetime?.positives ?? 0) + (linkedin?.totals.positives ?? 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <SectionFreshness factDate={latestSnapshot?.snapshot_date} />
      </div>

      {/* One card per channel — deliberately separate, windows stated. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email
              </CardTitle>
              <Link
                href={`/clients/${clientSlug}?tab=email`}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Open Email tab
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <ChannelStat label="Sent (7d)" value={week.sent.toLocaleString()} />
              <ChannelStat
                label="Positive (7d)"
                value={week.positives.toLocaleString()}
                emphasize
              />
              <ChannelStat
                label="Reply rate (7d)"
                value={
                  week.sent > 0
                    ? `${((week.replies / week.sent) * 100).toFixed(2)}%`
                    : "—"
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">
              All-time: {emailLifetime?.sent.toLocaleString() ?? "—"} sent ·{" "}
              {emailLifetime?.positives.toLocaleString() ?? "—"} positive replies
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <Linkedin className="h-4 w-4 text-muted-foreground" />
                LinkedIn
                {linkedin && !linkedin.anyActive && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                    <PauseCircle className="h-3 w-3" />
                    paused
                  </span>
                )}
              </CardTitle>
              <Link
                href={`/clients/${clientSlug}?tab=linkedin`}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Open LinkedIn tab
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {linkedin ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <ChannelStat
                    label="Connections sent"
                    value={linkedin.totals.sent.toLocaleString()}
                  />
                  <ChannelStat
                    label="Accepted"
                    value={`${linkedin.totals.accepted.toLocaleString()}${
                      linkedin.totals.acceptRate != null
                        ? ` (${linkedin.totals.acceptRate.toFixed(1)}%)`
                        : ""
                    }`}
                  />
                  <ChannelStat
                    label="Positive replies"
                    value={linkedin.totals.positives.toLocaleString()}
                    emphasize
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Since launch{liSnapshotLabel ? ` · snapshot ${liSnapshotLabel}` : ""} ·{" "}
                  {linkedin.campaigns.length} campaign
                  {linkedin.campaigns.length === 1 ? "" : "s"}
                </p>
              </>
            ) : (
              <p className="py-3 text-sm text-muted-foreground">
                No LinkedIn campaigns registered for this client.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* The one combined figure — all-time on BOTH sides, stated as such. */}
      <Card>
        <CardContent className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-4">
          <span className="text-sm text-muted-foreground">
            Positive replies to date, both channels:
          </span>
          <span className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {combinedPositives.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">
            = {emailLifetime?.positives.toLocaleString() ?? 0} email +{" "}
            {linkedin?.totals.positives.toLocaleString() ?? 0} LinkedIn · channels
            stay separate above because their windows and mechanics differ
          </span>
        </CardContent>
      </Card>
    </div>
  )
}

function ChannelStat({
  label,
  value,
  emphasize,
}: {
  label: string
  value: string
  emphasize?: boolean
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-0.5 text-lg font-bold tabular-nums ${
          emphasize ? "text-emerald-600 dark:text-emerald-400" : ""
        }`}
      >
        {value}
      </div>
    </div>
  )
}
