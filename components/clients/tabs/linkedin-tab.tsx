import { format } from "date-fns"
import { Linkedin, PauseCircle, UserCheck, UserPlus, MessageSquare, MessagesSquare, ThumbsUp, Percent } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricCard } from "@/components/shared/metric-card"
import { EmptyState } from "@/components/shared/empty-state"
import { getClientLinkedIn } from "@/lib/queries/linkedin"
import { cn } from "@/lib/utils"

/**
 * V5 — the LinkedIn tab (Omar: "how many connection requests sent, how many
 * accepted, how many positive replies, the different campaigns running").
 * Reads the cockpit's linkedin_* tables (migration 028) — currently the
 * verified 2026-06-26 review snapshot, which IS current state because every
 * campaign has been paused since that QA hold. The banner says exactly that,
 * so nobody mistakes a frozen number for a live one.
 */

const STATUS_CHIP: Record<string, string> = {
  active:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  paused: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
}

export async function LinkedInTab({ clientSlug }: { clientSlug: string }) {
  const data = await getClientLinkedIn(clientSlug)

  if (!data) {
    return (
      <EmptyState
        icon={Linkedin}
        title="No LinkedIn campaigns"
        description="This client has no Aimfox campaigns registered yet."
      />
    )
  }

  const { campaigns, totals, snapshotDate, anyActive } = data
  const snapshotLabel = snapshotDate
    ? format(new Date(`${snapshotDate}T00:00:00`), "d MMM yyyy")
    : null
  const unmessaged = Math.max(0, totals.accepted - totals.messages)

  return (
    <div className="space-y-6">
      {/* Provenance banner — loud on purpose. */}
      {!anyActive && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <PauseCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">
              All LinkedIn campaigns are paused (QA hold since 26 Jun).
            </p>
            <p className="mt-0.5 text-xs opacity-90">
              Numbers below are the verified snapshot of {snapshotLabel} — current
              while paused. A daily Aimfox sync is the follow-up that keeps this
              tab live once campaigns resume.
            </p>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Connection Requests Sent"
          value={totals.sent.toLocaleString()}
          icon={UserPlus}
          subtitle={`of ${totals.targetsLoaded.toLocaleString()} targets loaded`}
        />
        <MetricCard
          title="Connections Accepted"
          value={totals.accepted.toLocaleString()}
          icon={UserCheck}
          valueColor="text-emerald-600"
        />
        <MetricCard
          title="Acceptance Rate"
          value={totals.acceptRate != null ? `${totals.acceptRate.toFixed(1)}%` : "—"}
          icon={Percent}
        />
        <MetricCard
          title="Messages Sent"
          value={totals.messages.toLocaleString()}
          icon={MessageSquare}
          subtitle={
            unmessaged > 0
              ? `${unmessaged.toLocaleString()} accepted connections not yet messaged`
              : undefined
          }
        />
        <MetricCard
          title="Replies"
          value={totals.replies.toLocaleString()}
          icon={MessagesSquare}
          subtitle="Raw Aimfox metric — undercounts; see note below"
        />
        <MetricCard
          title="Positive Replies"
          value={totals.positives.toLocaleString()}
          icon={ThumbsUp}
          valueColor="text-emerald-600"
          subtitle="Verified against the reply log"
        />
      </div>

      {/* Per-campaign table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            Campaigns ({campaigns.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Campaign / Sender</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium text-right">Sent</th>
                  <th className="pb-2 pr-4 font-medium text-right">Accepted</th>
                  <th className="pb-2 pr-4 font-medium text-right">Accept %</th>
                  <th className="pb-2 pr-4 font-medium text-right">Msgs</th>
                  <th className="pb-2 pr-4 font-medium text-right">Replies</th>
                  <th className="pb-2 font-medium text-right">Targets</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2.5 pr-4">
                      <span className="font-medium">{c.name}</span>
                      {c.persona && (
                        <span className="block text-xs text-muted-foreground">
                          {c.persona}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                          STATUS_CHIP[c.status] ?? STATUS_CHIP.paused
                        )}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {c.sent.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {c.accepted.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {c.acceptRate != null ? `${c.acceptRate.toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {c.messages.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {c.replies.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                      {c.targetsLoaded != null ? c.targetsLoaded.toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Sent / Accepted / Msgs come from Aimfox&apos;s campaign metrics
            (reliable). The per-campaign Replies figure is Aimfox&apos;s raw
            metric, which undercounts — reply sentiment is verified manually
            against the response log until the daily sync lands. Data as of{" "}
            {snapshotLabel ?? "—"}.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
