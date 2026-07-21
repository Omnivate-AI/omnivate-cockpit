import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import { getActiveClients, resolveClientSlugs } from "@/lib/queries/clients"
import { rangeWindow } from "@/lib/queries/analytics"

// Item-5 read models (migration cockpit_read_models_006):
//   vw_cockpit_portfolio_health — per-client infra roll-up (PORT-2/3)
//   vw_cockpit_recipient_daily  — sends+replies by RECIPIENT provider
//   vw_cockpit_lifecycle_daily  — sp_mailbox_daily rollup (HEALTH-4)

export interface PortfolioHealthRow {
  client: string
  active: boolean
  open_alerts: number
  at_risk_mailboxes: number
  listed_domains: number
  non_retired_mailboxes: number
  active_mailboxes: number
  /** Mailboxes marked burnt — need same-day replacement (V3 Phase 6). */
  burnt_mailboxes: number
}

export const getPortfolioHealth = cache(
  async (): Promise<PortfolioHealthRow[]> => {
    const supabase = createServerClient()
    const activeSlugs = await getActiveClients()
    const { data } = await supabase
      .from("vw_cockpit_portfolio_health")
      .select("*")
      .in("client", activeSlugs)
    return (data ?? []) as PortfolioHealthRow[]
  }
)

// --- Recipient-provider performance ---

export interface RecipientProviderRow {
  provider: "google" | "microsoft" | "other"
  sent: number
  replies: number
  replyRate: number
}

export const getClientRecipientSplit = cache(
  async (client: string, days: number = 14): Promise<RecipientProviderRow[]> => {
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)

    // V4 C1: business-day-anchored window, matching getClientProviderSplit —
    // the two panels of the provider card previously covered slightly
    // different windows (calendar cutoff vs facts anchor) under one title.
    const { cutoff, anchor } = await rangeWindow(days)

    const { data } = await supabase
      .from("vw_cockpit_recipient_daily")
      .select("*")
      .in("client", slugs)
      .gte("snapshot_date", cutoff)
      .lte("snapshot_date", anchor ?? cutoff)

    const totals = {
      google: { sent: 0, replies: 0 },
      microsoft: { sent: 0, replies: 0 },
      other: { sent: 0, replies: 0 },
    }
    for (const r of data ?? []) {
      totals.google.sent += r.sent_google ?? 0
      totals.google.replies += r.replies_google ?? 0
      totals.microsoft.sent += r.sent_microsoft ?? 0
      totals.microsoft.replies += r.replies_microsoft ?? 0
      totals.other.sent += r.sent_other ?? 0
      totals.other.replies += r.replies_other ?? 0
    }

    return (Object.keys(totals) as Array<keyof typeof totals>).map((p) => ({
      provider: p,
      sent: totals[p].sent,
      replies: totals[p].replies,
      replyRate:
        totals[p].sent > 0 ? (totals[p].replies / totals[p].sent) * 100 : 0,
    }))
  }
)

// --- Lifecycle / health history (HEALTH-4) ---

export interface LifecycleDailyRow {
  client: string
  snapshot_date: string
  total: number
  active: number
  resting: number
  reserve: number
  warming: number
  parked: number
  burnt: number
  retired: number
  masters: number
  avg_warmup: number | null
  blacklisted: number
  at_risk: number
}

export interface LifecycleHistory {
  rows: LifecycleDailyRow[]
  daysCollected: number
  firstSnapshotDate: string | null
}

export const getClientLifecycleHistory = cache(
  async (client: string, days: number = 30): Promise<LifecycleHistory> => {
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    const { data } = await supabase
      .from("vw_cockpit_lifecycle_daily")
      .select("*")
      .in("client", slugs)
      .gte("snapshot_date", cutoff.toISOString().split("T")[0])
      .order("snapshot_date", { ascending: true })

    // Aggregate child slugs per date (parent clients)
    const byDate = new Map<string, LifecycleDailyRow>()
    for (const r of (data ?? []) as LifecycleDailyRow[]) {
      const e = byDate.get(r.snapshot_date)
      if (!e) {
        byDate.set(r.snapshot_date, { ...r, client })
      } else {
        e.total += r.total
        e.active += r.active
        e.resting += r.resting
        e.reserve += r.reserve
        e.warming += r.warming
        e.parked += r.parked
        e.burnt += r.burnt
        e.retired += r.retired
        e.masters += r.masters
        e.blacklisted += r.blacklisted
        e.at_risk += r.at_risk
        // Mailbox-count-WEIGHTED grand mean across child slugs (V2 Phase 7).
        // vw_cockpit_lifecycle_daily.avg_warmup is already a true per-mailbox
        // mean over that slug's `total` boxes, so Σ(avgᵢ·totalᵢ)/Σtotalᵢ
        // reconstructs the exact grand mean. The old `(a+b)/2` was unweighted
        // (a 20-box slug counted equally to a 2-box slug) and order-dependent
        // for >2 children. `e.total` was already incremented above, so we
        // recover the pre-merge weight from the incoming row + running total.
        if (r.avg_warmup !== null) {
          const wPrev = e.total - r.total // e.total already includes r.total
          const prevSum =
            e.avg_warmup !== null ? Number(e.avg_warmup) * wPrev : 0
          const combinedW = wPrev + r.total
          e.avg_warmup =
            combinedW > 0
              ? Number(
                  ((prevSum + Number(r.avg_warmup) * r.total) / combinedW).toFixed(1)
                )
              : e.avg_warmup
        }
      }
    }

    const rows = Array.from(byDate.values()).sort((a, b) =>
      a.snapshot_date.localeCompare(b.snapshot_date)
    )
    return {
      rows,
      daysCollected: rows.length,
      firstSnapshotDate: rows[0]?.snapshot_date ?? null,
    }
  }
)
