import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import { resolveClientSlugs } from "@/lib/queries/clients"

// Infrastructure orders & spend (INFRA-4) + domain blacklist (HEALTH-3).
// Reads:
//   vw_cockpit_orders    — sp_orders + spend semantics (spent_usd only counts
//                          completed orders; failed/superseded charged $0,
//                          awaiting_approval is projected cost)
//   vw_cockpit_blacklist — latest DNSBL state per domain from the email-infra
//                          routine's daily check (listed | clean | couldnt_check)

export interface CockpitOrder {
  id: number
  client: string
  order_type: string | null
  status: string
  domain_count: number
  mailbox_count: number
  platform_mix: Record<string, number> | null
  total_cost_usd: number
  spent_usd: number
  inboxkit_order_id: string | null
  billing_discrepancy: boolean | null
  order_date: string
  placed_at: string | null
  completed_at: string | null
}

/** Normalize platform_mix keys (data has both "GOOGLE" and "google"). */
export function normalizePlatformMix(
  mix: Record<string, number> | null
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(mix ?? {})) {
    const key = k.toLowerCase()
    out[key] = (out[key] ?? 0) + (Number(v) || 0)
  }
  return out
}

export const getOrders = cache(async (): Promise<CockpitOrder[]> => {
  const supabase = createServerClient()
  const { data } = await supabase
    .from("vw_cockpit_orders")
    .select(
      "id, client, order_type, status, domain_count, mailbox_count, platform_mix, total_cost_usd, spent_usd, inboxkit_order_id, billing_discrepancy, order_date, placed_at, completed_at"
    )
    .order("order_date", { ascending: false })

  return ((data ?? []) as CockpitOrder[]).map((o) => ({
    ...o,
    total_cost_usd: Number(o.total_cost_usd) || 0,
    spent_usd: Number(o.spent_usd) || 0,
  }))
})

export const getClientOrders = cache(
  async (client: string): Promise<CockpitOrder[]> => {
    const slugs = await resolveClientSlugs(client)
    const all = await getOrders()
    return all.filter((o) => slugs.includes(o.client))
  }
)

// --- Blacklist (HEALTH-3) ---

export interface BlacklistRow {
  domain: string
  client: string | null
  mailbox_count: number | null
  status: string // listed | clean | couldnt_check
  listed_on: string | null
  severity: string | null // high | medium (when listed)
  last_checked_at: string | null
  first_listed_at: string | null
}

export interface BlacklistSummary {
  rows: BlacklistRow[]
  /** CONFIRMED authoritative DNSBL listings only — the ones that actually
      warrant action. Excludes Smartlead's UI badge (V3 Phase 5). */
  listed: BlacklistRow[]
  /** Smartlead's "Blacklisted" UI badge — shared-IP / SURBL noise, NOT a
      confirmed DNSBL listing (all 135 estate-wide were these; placement stays
      100% inbox). Surfaced separately, clearly de-rated. */
  smartleadFlagged: BlacklistRow[]
  cleanCount: number
  uncheckableCount: number
  latestCheckAt: string | null
}

/** Smartlead's UI "Blacklisted" badge writes listed_on = "SmartleadBadge: …".
    It is not an authoritative DNSBL check (Omar V3 blacklist reconciliation). */
function isSmartleadBadge(r: BlacklistRow): boolean {
  return (r.listed_on ?? "").toLowerCase().startsWith("smartleadbadge")
}

function summarizeBlacklist(rows: BlacklistRow[]): BlacklistSummary {
  const bySeverity = (a: BlacklistRow, b: BlacklistRow) =>
    (a.severity === "high" ? -1 : 1) - (b.severity === "high" ? -1 : 1)
  const allListed = rows.filter((r) => r.status === "listed")
  const listed = allListed.filter((r) => !isSmartleadBadge(r)).sort(bySeverity)
  const smartleadFlagged = allListed.filter(isSmartleadBadge).sort(bySeverity)
  let latestCheckAt: string | null = null
  for (const r of rows) {
    if (r.last_checked_at && (!latestCheckAt || r.last_checked_at > latestCheckAt)) {
      latestCheckAt = r.last_checked_at
    }
  }
  return {
    rows,
    listed,
    smartleadFlagged,
    cleanCount: rows.filter((r) => r.status === "clean").length,
    uncheckableCount: rows.filter((r) => r.status === "couldnt_check").length,
    latestCheckAt,
  }
}

export const getClientBlacklist = cache(
  async (client: string): Promise<BlacklistSummary> => {
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)
    const { data } = await supabase
      .from("vw_cockpit_blacklist")
      .select("*")
      .in("client", slugs)
    return summarizeBlacklist((data ?? []) as BlacklistRow[])
  }
)
