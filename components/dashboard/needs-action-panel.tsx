import Link from "next/link"
import { AlertTriangle, Flame, ShieldAlert, CheckCircle2, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { PortfolioHealthRow } from "@/lib/queries/portfolio"

function titleCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/**
 * V3 Phase 6 (I1/I2) — the "deal with it today" queue. Aggregates every
 * mailbox/domain needing same-day attention across all clients: at-risk warmup
 * boxes (<97%), burnt boxes, and CONFIRMED blacklist listings (the Smartlead
 * badge noise is excluded upstream in vw_cockpit_portfolio_health). Each client
 * links straight to its Mailboxes tab, where the rest / rotate / retire actions
 * live. The cockpit is the human gate; the email-infra engines remain the only
 * actors — nothing spends or mutates from this panel.
 *
 * Full agent auto-propose (Option B) is an email-infra plugin follow-up; this
 * is the cockpit surface (Option A / the human-gate half of C).
 */
export function NeedsActionPanel({ rows }: { rows: PortfolioHealthRow[] }) {
  const items = rows
    .map((r) => ({
      client: r.client,
      atRisk: r.at_risk_mailboxes,
      burnt: r.burnt_mailboxes,
      listed: r.listed_domains,
      total: r.at_risk_mailboxes + r.burnt_mailboxes + r.listed_domains,
    }))
    .filter((i) => i.total > 0)
    .sort((a, b) => b.total - a.total)

  const grandTotal = items.reduce((s, i) => s + i.total, 0)

  if (grandTotal === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        All clear — no mailboxes at-risk, burnt, or blacklisted across any client today.
      </div>
    )
  }

  return (
    <Card className="border-amber-300 dark:border-amber-900">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Needs Action Today
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
            {grandTotal}
          </span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Mailboxes &amp; domains to deal with today — never leave these sitting. Click a
          client to act on its Mailboxes tab.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((i) => (
          <Link
            key={i.client}
            href={`/clients/${i.client}?tab=mailboxes`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
          >
            <span className="font-medium">{titleCase(i.client)}</span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
              {i.atRisk > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <ShieldAlert className="h-3.5 w-3.5" /> {i.atRisk} at-risk
                </span>
              )}
              {i.burnt > 0 && (
                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                  <Flame className="h-3.5 w-3.5" /> {i.burnt} burnt
                </span>
              )}
              {i.listed > 0 && (
                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                  <ShieldAlert className="h-3.5 w-3.5" /> {i.listed} blacklisted
                </span>
              )}
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
