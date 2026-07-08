import { Database } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataAsOf } from "@/components/shared/data-as-of"
import type { ReadyBankRow } from "@/lib/queries/ready-bank"

/**
 * Ready Bank (Omar 2026-07-06) — replaces the lead-pipeline funnel with
 * the questions he actually asked:
 *   qualified TAM → verified emails → (in campaigns | available) and
 *   LinkedIn-only, with the AVAILABLE count as the hero.
 * Every number carries its own explanation.
 */
export function ReadyBankCard({ data }: { data: ReadyBankRow | null }) {
  if (!data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            Ready Bank
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No Ready Bank snapshot yet for this client — the daily job
            (09:12 UTC) populates it from the qualified-lead database.
          </p>
        </CardContent>
      </Card>
    )
  }

  const pctOfVerified = (n: number) =>
    data.email_verified > 0 ? (n / data.email_verified) * 100 : 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            Ready Bank
          </CardTitle>
          <DataAsOf mode="facts" factDate={data.snapshot_date} />
        </div>
        <p className="text-xs text-muted-foreground">
          Leads in our database and how many we can still contact
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hero: the fuel tank */}
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {data.available_email.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">
              verified emails, not yet in any campaign
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            This is what the next campaign (or a top-up) can draw from.
          </p>
        </div>

        {/* Verified split bar: in campaigns vs available */}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Verified emails: {data.email_verified.toLocaleString()}</span>
            <span className="tabular-nums">
              {Math.round(pctOfVerified(data.available_email))}% still available
            </span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-stone-400 dark:bg-stone-600"
              style={{ width: `${pctOfVerified(data.in_campaign)}%` }}
              title={`In campaigns: ${data.in_campaign.toLocaleString()}`}
            />
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${pctOfVerified(data.available_email)}%` }}
              title={`Available: ${data.available_email.toLocaleString()}`}
            />
          </div>
        </div>

        {/* The numbers, each explained. "Total reachable" = everyone not
            ruled out (lead_status); "Qualified" = only those actually
            stamped qualification_decision='qualified' (migration 016). */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <ReadyBankStat
            value={data.qualified_total}
            label="Total reachable"
            hint="Everyone we haven't ruled out (incl. LinkedIn-only)"
          />
          {/* Only meaningful for clients that gate on qualification_decision
              (cylindo/AP). paycaptain populates it barely (151) and omnivate
              lacks the column — they qualify via other fields — so show n/a
              rather than a misleading near-zero. Schema drift Omar owns. */}
          <ReadyBankStat
            value={
              data.qualified > 0 && data.qualified >= data.qualified_total * 0.05
                ? data.qualified
                : "n/a"
            }
            label="Qualified"
            hint={
              data.qualified > 0 && data.qualified >= data.qualified_total * 0.05
                ? "Actually passed qualification"
                : "This client qualifies via other fields"
            }
          />
          <ReadyBankStat
            value={data.email_verified}
            label="Verified email"
            hint="Email verified as working"
          />
          <ReadyBankStat
            value={data.linkedin_only}
            label="LinkedIn-only"
            hint="No working email — reachable via LinkedIn"
          />
          <ReadyBankStat
            value={data.in_campaign}
            label="In campaigns"
            hint="Already uploaded to Smartlead (reached out or queued)"
          />
        </div>
      </CardContent>
    </Card>
  )
}

function ReadyBankStat({
  value,
  label,
  hint,
}: {
  value: number | string
  label: string
  hint: string
}) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <div className="text-lg font-semibold tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="text-[11px] font-medium">{label}</div>
      <div className="text-[10px] text-muted-foreground">{hint}</div>
    </div>
  )
}
