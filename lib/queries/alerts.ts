import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import type { MailboxAlert } from "@/lib/types"
import type { AlertWithDomain } from "./clients"

// All alert reads go through vw_cockpit_alerts (sp_infra_alerts + domain name).
// Status vocabulary is the sp_* one: open | resolved.

// --- Interfaces ---

export interface AlertListFilters {
  severity?: string | null
  client?: string | null
  alertType?: string | null
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
      resolved = false,
      page = 1,
      pageSize = 25,
    } = filters

    let query = supabase
      .from("vw_cockpit_alerts")
      .select("*", { count: "exact" })
      .eq("status", resolved ? "resolved" : "open")
      .order("created_at", { ascending: false })

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

    const [unresolvedRes, resolvedRes] = await Promise.all([
      supabase
        .from("vw_cockpit_alerts")
        .select("*", { count: "exact", head: true })
        .eq("status", "open"),
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

    let query = supabase
      .from("vw_cockpit_alerts")
      .select("*")
      .eq("status", "open")
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
    const recentlyResolved = (
      (resolvedRes.data ?? []) as AlertWithDomain[]
    ).map(normalize)

    const summary: ClientAlertSummary = {
      critical: unresolved.filter((a) =>
        ["critical", "high"].includes(a.severity)
      ).length,
      warning: unresolved.filter((a) =>
        ["warning", "medium"].includes(a.severity)
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
  async (): Promise<GlobalAlertSummary> => {
    const supabase = createServerClient()

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const weekAgo = sevenDaysAgo.toISOString()

    const [criticalRes, warningRes, resolvedRes] = await Promise.all([
      supabase
        .from("vw_cockpit_alerts")
        .select("*", { count: "exact", head: true })
        .eq("status", "open")
        .in("severity", ["critical", "high"]),
      supabase
        .from("vw_cockpit_alerts")
        .select("*", { count: "exact", head: true })
        .eq("status", "open")
        .in("severity", ["warning", "medium"]),
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
