import Link from "next/link"
import { Inbox, ShieldAlert, AlertTriangle, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PortfolioHealthRow } from "@/lib/queries/portfolio"

/**
 * PORT-3: portfolio-level infrastructure roll-up — the whole book's infra
 * state in one line above the client grid. Per-client detail lives on the
 * cards below and deep-links into each client (PORT-2).
 */
export function PortfolioHealthStrip({
  rows,
}: {
  rows: PortfolioHealthRow[]
}) {
  if (rows.length === 0) return null

  const totals = rows.reduce(
    (acc, r) => ({
      boxes: acc.boxes + r.non_retired_mailboxes,
      atRisk: acc.atRisk + r.at_risk_mailboxes,
      listed: acc.listed + r.listed_domains,
      alerts: acc.alerts + r.open_alerts,
    }),
    { boxes: 0, atRisk: 0, listed: 0, alerts: 0 }
  )

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border bg-card px-4 py-2.5 text-sm">
      <span className="flex items-center gap-1.5 font-medium">
        <Inbox className="h-4 w-4 text-muted-foreground" />
        Infrastructure across clients
      </span>
      <span className="tabular-nums">
        <strong>{totals.boxes.toLocaleString()}</strong>{" "}
        <span className="text-muted-foreground">mailboxes in play</span>
      </span>
      <span
        className={cn(
          "tabular-nums",
          totals.atRisk > 0 && "font-medium text-amber-600 dark:text-amber-400"
        )}
      >
        <strong>{totals.atRisk}</strong>{" "}
        <span className={totals.atRisk > 0 ? "" : "text-muted-foreground"}>
          at-risk (&lt;97% warmup)
        </span>
      </span>
      <span
        className={cn(
          "flex items-center gap-1 tabular-nums",
          totals.listed > 0 && "font-semibold text-rose-600 dark:text-rose-400"
        )}
      >
        {totals.listed > 0 && <ShieldAlert className="h-3.5 w-3.5" />}
        <strong>{totals.listed}</strong>{" "}
        <span className={totals.listed > 0 ? "" : "text-muted-foreground"}>
          blacklisted domains
        </span>
      </span>
      <Link
        href="/alerts"
        className={cn(
          "flex items-center gap-1 tabular-nums hover:underline",
          totals.alerts > 0 && "text-rose-600 dark:text-rose-400"
        )}
      >
        {totals.alerts > 0 && <AlertTriangle className="h-3.5 w-3.5" />}
        <strong>{totals.alerts}</strong>{" "}
        <span className={totals.alerts > 0 ? "" : "text-muted-foreground"}>
          open alerts
        </span>
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
}
