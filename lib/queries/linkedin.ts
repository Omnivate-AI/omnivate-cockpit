import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import { resolveClientSlugs } from "@/lib/queries/clients"

/**
 * V5 — LinkedIn (Aimfox) outreach reads. Source: the cockpit-owned
 * sp_linkedin_campaigns registry + sp_linkedin_daily_campaign_facts CUMULATIVE
 * snapshots (migration 028), mirroring the email pattern (sp_campaigns +
 * sp_daily_campaign_facts). The cockpit never calls Aimfox live — a daily
 * sync job (plugin/trigger stack) is the follow-up that keeps these fresh;
 * until then the seed is the verified 2026-06-26 review, which is CURRENT
 * because every campaign has been paused since that QA hold.
 */

export interface LinkedInCampaignStat {
  id: string
  name: string
  persona: string | null
  status: string
  targetsLoaded: number | null
  sent: number
  accepted: number
  acceptRate: number | null
  messages: number
  replies: number
  positives: number
}

export interface ClientLinkedIn {
  campaigns: LinkedInCampaignStat[]
  totals: {
    sent: number
    accepted: number
    acceptRate: number | null
    messages: number
    replies: number
    positives: number
    targetsLoaded: number
  }
  /** Latest snapshot date across this client's campaigns. */
  snapshotDate: string | null
  source: string | null
  anyActive: boolean
}

interface RegistryRow {
  aimfox_campaign_id: string
  client: string
  name: string
  persona: string | null
  targets_loaded: number | null
  status: string
}

interface FactRow {
  aimfox_campaign_id: string
  snapshot_date: string
  connections_sent: number | null
  connections_accepted: number | null
  messages_sent: number | null
  replies: number | null
  positive_replies: number | null
  source: string | null
}

export const getClientLinkedIn = cache(
  async (client: string): Promise<ClientLinkedIn | null> => {
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)

    const { data: regs } = await supabase
      .from("sp_linkedin_campaigns")
      .select("aimfox_campaign_id, client, name, persona, targets_loaded, status")
      .in("client", slugs)
      .order("name", { ascending: true })
    if (!regs || regs.length === 0) return null

    const ids = (regs as RegistryRow[]).map((r) => r.aimfox_campaign_id)
    const { data: facts } = await supabase
      .from("sp_linkedin_daily_campaign_facts")
      .select("*")
      .in("aimfox_campaign_id", ids)
      .order("snapshot_date", { ascending: false })

    // Facts are cumulative — the latest snapshot per campaign is its state.
    const latestByCampaign = new Map<string, FactRow>()
    for (const f of (facts ?? []) as FactRow[]) {
      if (!latestByCampaign.has(f.aimfox_campaign_id)) {
        latestByCampaign.set(f.aimfox_campaign_id, f)
      }
    }

    let snapshotDate: string | null = null
    let source: string | null = null
    const campaigns: LinkedInCampaignStat[] = (regs as RegistryRow[]).map((r) => {
      const f = latestByCampaign.get(r.aimfox_campaign_id)
      if (f && (!snapshotDate || f.snapshot_date > snapshotDate)) {
        snapshotDate = f.snapshot_date
        source = f.source
      }
      const sent = f?.connections_sent ?? 0
      const accepted = f?.connections_accepted ?? 0
      return {
        id: r.aimfox_campaign_id,
        name: r.name,
        persona: r.persona,
        status: r.status,
        targetsLoaded: r.targets_loaded,
        sent,
        accepted,
        acceptRate: sent > 0 ? (accepted / sent) * 100 : null,
        messages: f?.messages_sent ?? 0,
        replies: f?.replies ?? 0,
        positives: f?.positive_replies ?? 0,
      }
    })

    const totals = campaigns.reduce(
      (acc, c) => {
        acc.sent += c.sent
        acc.accepted += c.accepted
        acc.messages += c.messages
        acc.replies += c.replies
        acc.positives += c.positives
        acc.targetsLoaded += c.targetsLoaded ?? 0
        return acc
      },
      {
        sent: 0,
        accepted: 0,
        acceptRate: null as number | null,
        messages: 0,
        replies: 0,
        positives: 0,
        targetsLoaded: 0,
      }
    )
    totals.acceptRate = totals.sent > 0 ? (totals.accepted / totals.sent) * 100 : null

    return {
      campaigns,
      totals,
      snapshotDate,
      source,
      anyActive: campaigns.some((c) => c.status === "active"),
    }
  }
)

/** Email all-time totals for the combined Overview's per-channel line. */
export const getClientEmailLifetime = cache(
  async (
    client: string
  ): Promise<{ sent: number; replies: number; positives: number } | null> => {
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)
    const { data } = await supabase
      .from("vw_cockpit_client_lifetime")
      .select("client, all_time_emails_sent, all_time_replies, all_time_interested")
      .in("client", slugs)
    if (!data || data.length === 0) return null
    return data.reduce(
      (acc, r) => {
        acc.sent += r.all_time_emails_sent ?? 0
        acc.replies += r.all_time_replies ?? 0
        acc.positives += r.all_time_interested ?? 0
        return acc
      },
      { sent: 0, replies: 0, positives: 0 }
    )
  }
)
