import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import type { MailboxAlert } from "@/lib/types"
import type { AlertWithDomain } from "./clients"

// All alert reads go through vw_cockpit_alerts (sp_infra_alerts UNION
// cockpit_alerts, + domain name + tier). Status vocabulary is the sp_*
// one: open | resolved.
//
// Alert rebuild (Omar 2026-07-06, migration 008): every alert carries a
// tier — 'actionable' (act now: burns, low rep, send blocks, lead runway)
// vs 'maintenance' (self-healing retries, cleanup). All TOP-LINE counts
// (Command Center KPI, sidebar badge, client cards, banners) count
// actionable ONLY — the raw pile is what made the old numbers untrusted.

// --- Interfaces ---

export interface AlertListFilters {
  severity?: string | null
  client?: string | null
  alertType?: string | null
  /** 'actionable' | 'maintenance' | null (null = all tiers) */
  tier?: string | null
  resolved?: boolean
  page?: number
  pageSize?: number
}

export interface AlertListResult {
  alerts: AlertWithDomain[]
  totalCount: number
}

export interface RecentAlert extends MailboxAlert {
  domain_name: string
}

export interface TopAlert {
  id: number
  alert_type: string
  severity: string
  title: string
  description: string | null
  client: string
  domain_name: string
  created_at: string
}

// --- Functions ---

export const getAlertList = cache(
  async (filters: AlertListFilters): Promise<AlertListResult> => {
    const supabase = createServerClient()

    const {
      severity,
      client,
      alertType,
      tier,
      resolved = false,
      page = 1,
      pageSize = 25,
    } = filters

    let query = supabase
      .from("vw_cockpit_alerts")
      .select("*", { count: "exact" })
      .eq("status", resolved ? "resolved" : "open")
      .order("created_at", { ascending: false })

    if (tier) {
      query = query.eq("tier", tier)
    }

    if (severity) {
      query = query.eq("severity", severity)
    }

    if (alertType) {
      query = query.eq("alert_type", alertType)
    }

    if (client) {
      query = query.eq("client", client)
    }

    const offset = (page - 1) * pageSize
    query = query.range(offset, offset + pageSize - 1)

    const { data, count } = await query

    if (!data) {
      return { alerts: [], totalCount: 0 }
    }

    const alerts: AlertWithDomain[] = (data as AlertWithDomain[]).map((a) => ({
      ...a,
      domain_name: a.domain_name ?? "—",
    }))

    return { alerts, totalCount: count ?? 0 }
  }
)

export const getAlertCounts = cache(
  async (): Promise<{
    unresolved: number
    resolved: number
  }> => {
    const supabase = createServerClient()

    // Sidebar badge counts ACTIONABLE, UN-ACKNOWLEDGED open alerts only
    // (migration 008 tier + Phase 8 acknowledge). An acked alert is not
    // "needs attention".
    const [unresolvedRes, resolvedRes] = await Promise.all([
      supabase
        .from("vw_cockpit_alerts")
        .select("*", { count: "exact", head: true })
        .eq("status", "open")
        .eq("tier", "actionable")
        .is("acknowledged_at", null),
      supabase
        .from("vw_cockpit_alerts")
        .select("*", { count: "exact", head: true })
        .eq("status", "resolved"),
    ])

    return {
      unresolved: unresolvedRes.count ?? 0,
      resolved: resolvedRes.count ?? 0,
    }
  }
)

export const getRecentAlerts = cache(
  async (limit: number, client?: string | null): Promise<RecentAlert[]> => {
    const supabase = createServerClient()

    // "Recent alerts" is a needs-attention preview → un-acknowledged only.
    let query = supabase
      .from("vw_cockpit_alerts")
      .select("*")
      .eq("status", "open")
      .is("acknowledged_at", null)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (client) {
      query = query.eq("client", client)
    }

    const { data } = await query

    return ((data ?? []) as RecentAlert[]).map((a) => ({
      ...a,
      domain_name: a.domain_name ?? "—",
    }))
  }
)

export interface ClientAlertSummary {
  critical: number
  warning: number
  /** Open maintenance-tier alerts — shown as a muted count, never as urgency */
  maintenance: number
  resolvedThisWeek: number
}

export interface ClientAlertData {
  unresolved: AlertWithDomain[]
  recentlyResolved: AlertWithDomain[]
  summary: ClientAlertSummary
}

export const getClientAlertData = cache(
  async (client: string): Promise<ClientAlertData> => {
    const supabase = createServerClient()

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const weekAgo = sevenDaysAgo.toISOString()

    const [unresolvedRes, resolvedRes] = await Promise.all([
      supabase
        .from("vw_cockpit_alerts")
        .select("*")
        .eq("status", "open")
        .eq("client", client)
        .order("created_at", { ascending: false }),
      supabase
        .from("vw_cockpit_alerts")
        .select("*")
        .eq("status", "resolved")
        .eq("client", client)
        .gte("resolved_at", weekAgo)
        .order("resolved_at", { ascending: false })
        .limit(20),
    ])

    const normalize = (a: AlertWithDomain): AlertWithDomain => ({
      ...a,
      domain_name: a.domain_name ?? "—",
    })

    const unresolved = ((unresolvedRes.data ?? []) as AlertWithDomain[]).map(
      normalize
    )
    // Actionable first (the act-now list), maintenance after; newest first
    // within each tier.
    unresolved.sort((a, b) => {
      const ta = a.tier === "maintenance" ? 1 : 0
      const tb = b.tier === "maintenance" ? 1 : 0
      if (ta !== tb) return ta - tb
      return (b.created_at ?? "").localeCompare(a.created_at ?? "")
    })
    const recentlyResolved = (
      (resolvedRes.data ?? []) as AlertWithDomain[]
    ).map(normalize)

    // Urgency counts come from ACTIONABLE, UN-ACKNOWLEDGED alerts only
    // (migration 008 tier + Phase 8 acknowledge). Acked alerts stay in the
    // list (greyed) but never count as "needs attention".
    const needsAction = unresolved.filter(
      (a) => a.tier !== "maintenance" && !a.acknowledged_at
    )
    const summary: ClientAlertSummary = {
      critical: needsAction.filter((a) =>
        ["critical", "high"].includes(a.severity)
      ).length,
      warning: needsAction.filter((a) =>
        ["warning", "medium"].includes(a.severity)
      ).length,
      maintenance: unresolved.filter(
        (a) => a.tier === "maintenance" && !a.acknowledged_at
      ).length,
      resolvedThisWeek: recentlyResolved.length,
    }

    return { unresolved, recentlyResolved, summary }
  }
)

export const getTopAlerts = cache(
  async (limit: number = 5): Promise<TopAlert[]> => {
    const supabase = createServerClient()

    const { data } = await supabase
      .from("vw_cockpit_alerts")
      .select(
        "id, alert_type, severity, title, description, created_at, client, domain_name"
      )
      .eq("status", "open")
      .eq("tier", "actionable") // the banner only promotes act-now alerts
      .is("acknowledged_at", null) // …that haven't been acknowledged (Phase 8)
      .order("severity", { ascending: true }) // critical before warning (alphabetical)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (!data) return []

    return data.map((a) => ({
      id: a.id,
      alert_type: a.alert_type,
      severity: a.severity,
      title: a.title,
      description: a.description,
      client: a.client ?? "",
      domain_name: a.domain_name ?? "—",
      created_at: a.created_at,
    }))
  }
)

export interface GlobalAlertSummary {
  critical: number
  warning: number
  resolvedThisWeek: number
}

export const getGlobalAlertSummary = cache(
  async (tier: string | null = "actionable"): Promise<GlobalAlertSummary> => {
    const supabase = createServerClient()

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const weekAgo = sevenDaysAgo.toISOString()

    const withTier = <T extends { eq: (c: string, v: string) => T }>(q: T): T =>
      tier ? q.eq("tier", tier) : q

    const [criticalRes, warningRes, resolvedRes] = await Promise.all([
      withTier(
        supabase
          .from("vw_cockpit_alerts")
          .select("*", { count: "exact", head: true })
          .eq("status", "open")
          .is("acknowledged_at", null)
          .in("severity", ["critical", "high"])
      ),
      withTier(
        supabase
          .from("vw_cockpit_alerts")
          .select("*", { count: "exact", head: true })
          .eq("status", "open")
          .is("acknowledged_at", null)
          .in("severity", ["warning", "medium"])
      ),
      supabase
        .from("vw_cockpit_alerts")
        .select("*", { count: "exact", head: true })
        .eq("status", "resolved")
        .gte("resolved_at", weekAgo),
    ])

    return {
      critical: criticalRes.count ?? 0,
      warning: warningRes.count ?? 0,
      resolvedThisWeek: resolvedRes.count ?? 0,
    }
  }
)

export const getDistinctAlertTypes = cache(async (): Promise<string[]> => {
  const supabase = createServerClient()

  const { data } = await supabase
    .from("vw_cockpit_alerts")
    .select("alert_type")
    .order("alert_type", { ascending: true })

  if (!data) return []

  const unique = [...new Set(data.map((r) => r.alert_type))]
  return unique
})
