import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import { resolveClientSlugs } from "@/lib/queries/clients"

// Ready Bank (Omar 2026-07-06; per-client truth pass V2 Phase 6; Universal
// Lead Ledger re-point 2026-07-20, ClickUp 869e3knmx) — the per-client lead
// fuel tank. Counts are materialized daily into cockpit_ready_bank_daily by
// fn_cockpit_snapshot_ready_bank (migration 025; pg_cron 09:12 UTC) from
// v_{slug}_tam (TAM membership) JOINed to the {slug}_leads ledger columns
// (email_sendable / outreach_status) — those scan 45k-260k lead rows, far
// too heavy per request. Accuracy bar is "last 24h": the ledger itself is
// refreshed by the smartlead-perf back-sync each morning (~07:43), before
// the 09:12 snapshot. Definitions doc: docs/V3-LEDGER-REPOINT.md.

export interface ReadyBankRow {
  client: string
  snapshot_date: string
  qualified_total: number // TAM universe (reachability-gated; Cylindo also fit-gated) — UI: "Total reachable"
  /** qualification_decision='qualified' count — NULL = NOT TRACKED. Uniform
      data-driven rule since migration 025: NULL when <1% of the client's TAM
      has been judged (paycaptain: 0.2% judged; omnivate: column missing —
      upstream ledger gap). Migration 018 replaced the fake 0 / the card's
      client-side 5% guess. */
  qualified: number | null
  /** qualified AND email_sendable — "qualified leads we can actually email"
      (V3 Phase 4 F1/F3). NULL when qualification isn't tracked for the client. */
  qualified_email_verified: number | null
  /** Ledger email_sendable = true (email_status verified or
      catch_all_verified) — NOT the deprecated verified_email/email_verified
      per-client columns. */
  email_verified: number
  /** Ledger: NOT email_sendable AND linkedin_url present. */
  linkedin_only: number
  /** TAM leads actually EMAILED at least once — ledger outreach_status IN
      ('emailed','replied'), back-synced daily from sp_send_events ∪ repliers
      ∪ historical floor. NOT the drifting smartlead_uploaded flag (which
      overstated by 3.7k-6k per client). */
  in_campaign: number
  /** Conservative: email_sendable AND outreach_status='none' — verified,
      never emailed AND never uploaded. Uploaded-but-never-emailed leads are
      deliberately excluded (queued or dead uploads — surfaced in the gap
      doc, not counted here). */
  available_email: number
}

/**
 * Latest Ready Bank snapshot for one client (parent slugs aggregate their
 * children by summing). Null when no snapshot exists yet.
 */
export const getClientReadyBank = cache(
  async (client: string): Promise<ReadyBankRow | null> => {
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)

    const { data } = await supabase
      .from("cockpit_ready_bank_daily")
      .select(
        "client, snapshot_date, qualified_total, qualified, qualified_email_verified, email_verified, linkedin_only, in_campaign, available_email"
      )
      .in("client", slugs)
      .order("snapshot_date", { ascending: false })
      .limit(slugs.length * 3)

    if (!data || data.length === 0) return null

    // Latest row per slug, then sum across children
    const latestBySlug = new Map<string, ReadyBankRow>()
    for (const r of data as ReadyBankRow[]) {
      if (!latestBySlug.has(r.client)) latestBySlug.set(r.client, r)
    }

    const rows = [...latestBySlug.values()]
    const base: ReadyBankRow = {
      client,
      snapshot_date: rows[0].snapshot_date,
      qualified_total: 0,
      // NULL-aware: stays null unless at least one child actually tracks
      // qualification — a parent of untracked children must say "not
      // tracked", not 0 (migration 018 semantics).
      qualified: null,
      qualified_email_verified: null,
      email_verified: 0,
      linkedin_only: 0,
      in_campaign: 0,
      available_email: 0,
    }
    for (const r of rows) {
      base.qualified_total += r.qualified_total ?? 0
      if (r.qualified != null) {
        base.qualified = (base.qualified ?? 0) + r.qualified
      }
      if (r.qualified_email_verified != null) {
        base.qualified_email_verified =
          (base.qualified_email_verified ?? 0) + r.qualified_email_verified
      }
      base.email_verified += r.email_verified ?? 0
      base.linkedin_only += r.linkedin_only ?? 0
      base.in_campaign += r.in_campaign ?? 0
      base.available_email += r.available_email ?? 0
      if (r.snapshot_date > base.snapshot_date) {
        base.snapshot_date = r.snapshot_date
      }
    }
    return base
  }
)

/** Latest Ready Bank row per slug — used by the Command Center bundle. */
export async function getReadyBankBySlug(
  slugs: string[]
): Promise<Map<string, ReadyBankRow>> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from("cockpit_ready_bank_daily")
    .select(
      "client, snapshot_date, qualified_total, qualified, email_verified, linkedin_only, in_campaign, available_email"
    )
    .in("client", slugs)
    .order("snapshot_date", { ascending: false })
    .limit(slugs.length * 3)

  const latestBySlug = new Map<string, ReadyBankRow>()
  for (const r of (data ?? []) as ReadyBankRow[]) {
    if (!latestBySlug.has(r.client)) latestBySlug.set(r.client, r)
  }
  return latestBySlug
}
