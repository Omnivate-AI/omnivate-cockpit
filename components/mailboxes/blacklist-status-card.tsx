import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataAsOf } from "@/components/shared/data-as-of"
import { cn } from "@/lib/utils"
import type { BlacklistSummary, BlacklistRow } from "@/lib/queries/orders"

/**
 * HEALTH-3: latest DNSBL state for the client's domains, from the email-infra
 * routine's daily check (vw_cockpit_blacklist). Listed domains are the loud
 * path; clean is a compact all-clear; couldnt_check is disclosed, not hidden.
 */
export function BlacklistStatusCard({ summary }: { summary: BlacklistSummary }) {
  const { rows, listed, smartleadFlagged, cleanCount, uncheckableCount, latestCheckAt } = summary

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <ShieldQuestion className="h-5 w-5 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No blacklist checks recorded for this client&apos;s domains yet —
            the email-infra daily routine populates them.
          </p>
        </CardContent>
      </Card>
    )
  }

  const hasListings = listed.length > 0

  return (
    <Card className={cn(hasListings && "border-rose-300 dark:border-rose-900")}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            {hasListings ? (
              <ShieldAlert className="h-4 w-4 text-rose-500" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            )}
            Blacklist Status
          </CardTitle>
          <DataAsOf
            mode="sync"
            prefix="Checked"
            syncedAt={latestCheckAt}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {hasListings && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-400">
              {listed.length} confirmed listed
            </span>
          )}
          {smartleadFlagged.length > 0 && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
              title="Smartlead's UI 'Blacklisted' badge — shared-IP / SURBL noise, not a confirmed DNSBL listing"
            >
              {smartleadFlagged.length} Smartlead-flagged (unverified)
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
            {cleanCount} clean
          </span>
          {uncheckableCount > 0 && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 font-medium text-stone-600 dark:bg-stone-800/60 dark:text-stone-400"
              title="DNSBL zones refused or timed out for these domains — state unknown, re-checked daily"
            >
              {uncheckableCount} unreachable
            </span>
          )}
        </div>

        {hasListings ? (
          <div className="overflow-x-auto rounded-md border border-rose-200 dark:border-rose-900">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b bg-rose-50/60 text-left text-muted-foreground dark:bg-rose-950/20">
                  <th className="px-3 py-2 font-medium">Domain</th>
                  <th className="px-3 py-2 font-medium">Severity</th>
                  <th className="px-3 py-2 font-medium">Listed On</th>
                  <th className="px-3 py-2 font-medium text-right">Mailboxes</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">First Listed</th>
                </tr>
              </thead>
              <tbody>
                {listed.map((r) => (
                  <ListedRow key={r.domain} row={r} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No domains on any authoritative DNSBL.
            {uncheckableCount > 0 &&
              ` ${uncheckableCount} of ${rows.length} couldn't be checked on the last run (DNSBL zone refused/timed out) — they re-check daily.`}
          </p>
        )}

        {/* Smartlead UI-badge flags — surfaced but de-rated: not a confirmed
            DNSBL listing (V3 Phase 5 blacklist reconciliation). */}
        {smartleadFlagged.length > 0 && (
          <details className="group rounded-md border border-dashed border-amber-300 px-3 py-2 dark:border-amber-900">
            <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              <ShieldQuestion className="h-3.5 w-3.5" />
              {smartleadFlagged.length} domain{smartleadFlagged.length === 1 ? "" : "s"} carry
              Smartlead&apos;s UI &quot;Blacklisted&quot; badge — unverified
            </summary>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Smartlead&apos;s badge fires on shared-IP / SURBL signals and is not a
              confirmed listing on any authoritative DNSBL. Our own daily DNSBL check
              shows these clean and inbox-placement stays ~100%, so they don&apos;t count
              toward &quot;blacklisted&quot;. Listed for awareness:
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {smartleadFlagged.map((r) => (
                <span
                  key={r.domain}
                  className="rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground"
                >
                  {r.domain}
                </span>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  )
}

function ListedRow({ row }: { row: BlacklistRow }) {
  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2 font-medium">{row.domain}</td>
      <td className="px-3 py-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
            row.severity === "high"
              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
              : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
          )}
        >
          {row.severity ?? "medium"}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {row.listed_on ?? "—"}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {row.mailbox_count ?? 0}
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
        {row.first_listed_at ? row.first_listed_at.slice(0, 10) : "—"}
      </td>
    </tr>
  )
}
