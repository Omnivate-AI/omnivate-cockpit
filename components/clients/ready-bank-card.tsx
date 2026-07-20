import { Database, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataAsOf } from "@/components/shared/data-as-of"
import type { ReadyBankRow } from "@/lib/queries/ready-bank"

/**
 * Ready Bank (Omar 2026-07-06; per-client truth pass V2 Phase 6; Universal
 * Lead Ledger re-point 2026-07-20) — the questions he actually asked:
 * reachable TAM → verified emails → (emailed | still available) and
 * LinkedIn-only, with AVAILABLE as the hero. Every number now comes from
 * the SAME standard ledger columns on every client (email_sendable,
 * outreach_status — knowledge/system-rules/lead-table-qualification-schema.md
 * § "The Universal Lead Ledger" in the omnivate repo):
 *
 *   - "Emailed" = ledger outreach_status IN ('emailed','replied'), NOT the
 *     deprecated uploaded flag — which overstated by 3.7k-6k leads on every
 *     client.
 *   - "Qualified" renders "Not tracked" under a uniform data rule (<1% of
 *     the TAM judged) instead of implying zero or near-zero.
 *   - "Available" is conservative: email_sendable AND outreach_status='none'
 *     (never emailed AND never uploaded).
 *
 * Definitions + reconcile evidence: docs/V3-LEDGER-REPOINT.md.
 */

// What "Qualified" means per client — shown in the ⓘ block. Parent groups
// and unknown slugs fall back to the generic line.
const QUALIFIED_NOTES: Record<string, string> = {
  cylindo:
    "Qualified = AI qualification verdicts on the fit-gated TAM (~22k qualified of ~45k — the rest still undecided, being worked through).",
  acceleration_partners:
    "Qualified = AI qualification verdicts (~54k qualified of ~66k; ~11k still undecided).",
  paycaptain:
    "Not tracked — a qualification pass never ran on this table (0.2% of rows have a verdict). List-building gated on title + verification instead.",
  omnivate:
    "Not tracked — this table doesn't carry the ledger's qualification verdict column yet (upstream gap flagged 2026-07-20); leads qualify via title + verification gates.",
}

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

  // Verified emails that are neither emailed nor counted available =
  // uploaded-but-never-emailed (queued in a campaign, or a dead upload).
  const uploadedNotEmailed = Math.max(
    0,
    data.email_verified - data.in_campaign - data.available_email
  )

  const qualifiedNote = QUALIFIED_NOTES[data.client]

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
              verified emails, never contacted and not in any campaign
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            This is what the next campaign (or a top-up) can draw from.
          </p>
        </div>

        {/* Verified split bar: emailed vs available (the gap between the two
            segments and 100% = uploaded-but-never-emailed) */}
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
              title={`Emailed at least once: ${data.in_campaign.toLocaleString()}`}
            />
            <div
              className="h-full bg-amber-300 dark:bg-amber-700"
              style={{ width: `${pctOfVerified(uploadedNotEmailed)}%` }}
              title={`Uploaded but never emailed (queued or stale): ${uploadedNotEmailed.toLocaleString()}`}
            />
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${pctOfVerified(data.available_email)}%` }}
              title={`Available: ${data.available_email.toLocaleString()}`}
            />
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-stone-400 dark:bg-stone-600" />
              emailed {data.in_campaign.toLocaleString()}
            </span>
            {uploadedNotEmailed > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-300 dark:bg-amber-700" />
                uploaded, never emailed {uploadedNotEmailed.toLocaleString()}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              available {data.available_email.toLocaleString()}
            </span>
          </div>
        </div>

        {/* The numbers, each explained */}
        {/* Lead with Qualified, then Qualified + verified email (Omar V3 F1:
            "start with qualified … then the ones that have verified emails
            from our qualified term"). Total-reachable + the channel splits
            follow. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <ReadyBankStat
            value={data.qualified ?? "Not tracked"}
            label="Qualified"
            hint={
              data.qualified != null
                ? "Passed AI qualification"
                : "No qualification verdict on this table"
            }
            muted={data.qualified == null}
          />
          <ReadyBankStat
            value={
              data.qualified == null
                ? "Not tracked"
                : data.qualified_email_verified ?? 0
            }
            label="Qualified + verified email"
            hint="Qualified AND a working email — the pool we can email now"
            muted={data.qualified == null}
          />
          <ReadyBankStat
            value={data.qualified_total}
            label="Total reachable"
            hint="Everyone we haven't ruled out (incl. LinkedIn-only)"
          />
          <ReadyBankStat
            value={data.email_verified}
            label="Verified email"
            hint="Working email we can send to — verified, incl. safe catch-all"
          />
          <ReadyBankStat
            value={data.linkedin_only}
            label="LinkedIn-only"
            hint="On LinkedIn, no working email — reachable via LinkedIn"
          />
          <ReadyBankStat
            value={data.in_campaign}
            label="Emailed"
            hint="Actually emailed at least once (Smartlead-synced truth)"
          />
        </div>

        {/* Where each line comes from — honesty visible in the UI (Phase 6) */}
        <details className="group rounded-md border border-dashed px-3 py-2">
          <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground">
            <Info className="h-3 w-3" />
            What these numbers mean for this client
          </summary>
          <ul className="mt-2 space-y-1 text-[11px] leading-snug text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Total reachable</span> — the TAM view:
              every lead not ruled out for a real reason (suppression, bad title, customer…).
              Email-channel failures don&apos;t disqualify; those leads stay LinkedIn-reachable.
            </li>
            {qualifiedNote && (
              <li>
                <span className="font-medium text-foreground">Qualified</span> — {qualifiedNote}
              </li>
            )}
            <li>
              <span className="font-medium text-foreground">Emailed</span> — the lead ledger&apos;s
              outreach status (emailed/replied), refreshed every morning from Smartlead send
              events + repliers + the pre-tracking historical floor. Not the upload flag:
              uploads overstate contact by thousands per client.
            </li>
            <li>
              <span className="font-medium text-foreground">Available</span> — verified email,
              never emailed, never uploaded (ledger status &quot;none&quot;).
              Uploaded-but-never-emailed leads (amber in the bar) are queued or stale uploads —
              recycling them is an ops decision.
            </li>
          </ul>
        </details>
      </CardContent>
    </Card>
  )
}

function ReadyBankStat({
  value,
  label,
  hint,
  muted,
}: {
  value: number | string
  label: string
  hint: string
  muted?: boolean
}) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <div
        className={
          typeof value === "number"
            ? "text-lg font-semibold tabular-nums"
            : muted
              ? "text-sm font-medium text-muted-foreground pt-1"
              : "text-lg font-semibold"
        }
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="text-[11px] font-medium">{label}</div>
      <div className="text-[10px] text-muted-foreground">{hint}</div>
    </div>
  )
}
