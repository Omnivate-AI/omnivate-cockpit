import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import { resolveClientSlugs } from "@/lib/queries/clients"

// Build-5 (R11): the email-infra plugin's sp_decisions table is the action
// contract. The plugin engines RAISE decisions (order-engine when the reserve
// bench is low; handle-burn when a bench drops below floor) and EXECUTE the
// approved ones (order_mailboxes → supervised place-step; lifecycle_correction
// → auto on the daily routine). The cockpit surfaces them per client and lets
// an operator approve/deny in place — the same status the Slack button writes.
//
// Columns (sp_decisions): id, client, persona, decision_type, severity, title,
// rationale, proposed_payload (jsonb), estimated_cost_usd, status, approved_by,
// approved_at, executed_at, run_id, expires_at, error, created_at, updated_at.

/** Statuses that still need a human decision. */
export const DECISION_OPEN_STATES = ["proposed", "pending"] as const
/** Approved but not yet executed by a supervised/auto run. */
export const DECISION_INFLIGHT_STATES = ["approved"] as const

export interface ClientDecision {
  id: number
  client: string
  decision_type: string
  severity: string | null
  title: string
  rationale: string | null
  proposed_payload: Record<string, unknown> | null
  estimated_cost_usd: number | null
  status: string
  approved_by: string | null
  approved_at: string | null
  executed_at: string | null
  error: string | null
  created_at: string
  updated_at: string | null
}

export interface ClientDecisionsData {
  /** proposed | pending — awaiting an approve/deny */
  needsAction: ClientDecision[]
  /** approved — awaiting the supervised/auto execution run */
  inFlight: ClientDecision[]
  /** executed | denied | superseded — recent, collapsed */
  resolved: ClientDecision[]
}

const SELECT =
  "id, client, decision_type, severity, title, rationale, proposed_payload, estimated_cost_usd, status, approved_by, approved_at, executed_at, error, created_at, updated_at"

export const getClientDecisions = cache(
  async (client: string): Promise<ClientDecisionsData> => {
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)

    const { data } = await supabase
      .from("sp_decisions")
      .select(SELECT)
      .in("client", slugs)
      .order("created_at", { ascending: false })
      .limit(200)

    const rows = (data ?? []) as ClientDecision[]
    const needsAction = rows.filter((d) =>
      (DECISION_OPEN_STATES as readonly string[]).includes(d.status)
    )
    const inFlight = rows.filter((d) =>
      (DECISION_INFLIGHT_STATES as readonly string[]).includes(d.status)
    )
    // recent resolved, capped — the panel collapses these
    const resolved = rows
      .filter(
        (d) =>
          !(DECISION_OPEN_STATES as readonly string[]).includes(d.status) &&
          !(DECISION_INFLIGHT_STATES as readonly string[]).includes(d.status)
      )
      .slice(0, 15)

    return { needsAction, inFlight, resolved }
  }
)

/** One-line human summary of a decision's payload for the panel. */
export function summarizeDecisionPayload(d: ClientDecision): string {
  const p = d.proposed_payload ?? {}
  if (d.decision_type === "order_mailboxes") {
    const n =
      (p.mailbox_count as number | undefined) ??
      (p.gap as number | undefined) ??
      null
    const dom = (p.domain_count as number | undefined) ?? null
    const bench = (p.reserve_now as number | undefined) ??
      (p.current_reserve as number | undefined) ?? null
    const bits: string[] = []
    if (n != null) bits.push(`${n} mailbox${n === 1 ? "" : "es"}`)
    if (dom != null) bits.push(`${dom} domain${dom === 1 ? "" : "s"}`)
    if (bench != null) bits.push(`bench now ${bench}`)
    return bits.join(" · ") || "reserve refill"
  }
  if (d.decision_type === "lifecycle_correction") {
    return "lifecycle / tag drift correction"
  }
  if (d.decision_type === "retire_domain") {
    const dom = (p.domain_name as string | undefined) ?? "domain"
    const n = (p.mailbox_count as number | undefined) ?? null
    return n != null
      ? `retire ${dom} · ${n} mailbox${n === 1 ? "" : "es"}`
      : `retire ${dom}`
  }
  return d.decision_type.replace(/_/g, " ")
}
