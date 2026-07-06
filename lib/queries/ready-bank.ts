import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import { resolveClientSlugs } from "@/lib/queries/clients"

// Ready Bank (Omar 2026-07-06) — the per-client qualified-lead fuel tank.
// Counts are materialized daily into cockpit_ready_bank_daily by
// fn_cockpit_snapshot_ready_bank (migration 010; pg_cron 09:12 UTC) from
// the per-client v_{slug}_tam views — those scan 80k+ lead rows, far too
// heavy per request. Accuracy bar is "last 24h".

export interface ReadyBankRow {
  client: string
  snapshot_date: string
  qualified_total: number
  email_verified: number
  linkedin_only: number
  in_campaign: number
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
        "client, snapshot_date, qualified_total, email_verified, linkedin_only, in_campaign, available_email"
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
      email_verified: 0,
      linkedin_only: 0,
      in_campaign: 0,
      available_email: 0,
    }
    for (const r of rows) {
      base.qualified_total += r.qualified_total ?? 0
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
      "client, snapshot_date, qualified_total, email_verified, linkedin_only, in_campaign, available_email"
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
