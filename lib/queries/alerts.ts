import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import type { MailboxAlert } from "@/lib/types"
import type { AlertWithDomain } from "./clients"

// --- Interfaces ---

export interface AlertListFilters {
  severity?: "warning" | "critical" | null
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
      .from("mailbox_alerts")
      .select("*, mailbox_domains(domain_name, client)", { count: "exact" })
      .eq("status", resolved ? "resolved" : "pending")
      .order("created_at", { ascending: false })

    if (severity) {
      query = query.eq("severity", severity)
    }

    if (alertType) {
      query = query.eq("alert_type", alertType)
    }

    const offset = (page - 1) * pageSize
    query = query.range(offset, offset + pageSize - 1)

    const { data, count } = await query

    if (!data) {
      return { alerts: [], totalCount: 0 }
    }

    let alerts: AlertWithDomain[] = data.map((a) => {
      const domain = a.mailbox_domains as unknown as {
        domain_name: string
        client: string
      } | null
      const { mailbox_domains: _, ...rest } = a
      return {
        ...rest,
        domain_name: domain?.domain_name ?? "Unknown",
        client: domain?.client ?? "",
      } as AlertWithDomain
    })

    if (client) {
      alerts = alerts.filter((a) => a.client === client)
    }

    return { alerts, totalCount: client ? alerts.length : (count ?? 0) }
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
        .from("mailbox_alerts")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("mailbox_alerts")
        .select("*", { count: "exact", head: true })
        .in("status", ["resolved", "dismissed"]),
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

    const query = supabase
      .from("mailbox_alerts")
      .select("*, mailbox_domains(domain_name, client)")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(limit)

    const { data } = await query
    if (!data) return []

    let alerts = data.map((a) => {
      const domain = a.mailbox_domains as unknown as {
        domain_name: string
        client: string
      } | null
      return {
        ...a,
        domain_name: domain?.domain_name ?? "Unknown",
        _client: domain?.client ?? "",
        mailbox_domains: undefined,
      }
    })

    if (client) {
      alerts = alerts.filter((a) => a._client === client)
    }

    return alerts.map(({ _client, ...rest }) => rest) as RecentAlert[]
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
        .from("mailbox_alerts")
        .select("*, mailbox_domains!inner(domain_name, client)")
        .eq("status", "pending")
        .eq("mailbox_domains.client", client)
        .order("created_at", { ascending: false }),
      supabase
        .from("mailbox_alerts")
        .select("*, mailbox_domains!inner(domain_name, client)")
        .in("status", ["resolved", "dismissed"])
        .eq("mailbox_domains.client", client)
        .gte("resolved_at", weekAgo)
        .order("resolved_at", { ascending: false })
        .limit(20),
    ])

    const mapAlert = (a: Record<string, unknown>): AlertWithDomain => {
      const domain = a.mailbox_domains as { domain_name: string; client: string } | null
      const { mailbox_domains: _, ...rest } = a
      return {
        ...rest,
        domain_name: domain?.domain_name ?? "Unknown",
        client: domain?.client ?? client,
      } as AlertWithDomain
    }

    const unresolved = (unresolvedRes.data ?? []).map(mapAlert)
    const recentlyResolved = (resolvedRes.data ?? []).map(mapAlert)

    const summary: ClientAlertSummary = {
      critical: unresolved.filter((a) => a.severity === "critical").length,
      warning: unresolved.filter((a) => a.severity === "warning").length,
      resolvedThisWeek: recentlyResolved.length,
    }

    return { unresolved, recentlyResolved, summary }
  }
)

export const getTopAlerts = cache(
  async (limit: number = 5): Promise<TopAlert[]> => {
    const supabase = createServerClient()

    const { data } = await supabase
      .from("mailbox_alerts")
      .select(
        "id, alert_type, severity, title, description, created_at, mailbox_domains(domain_name, client)"
      )
      .eq("status", "pending")
      .order("severity", { ascending: true }) // critical before warning (alphabetical)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (!data) return []

    return data.map((a) => {
      const domain = a.mailbox_domains as unknown as {
        domain_name: string
        client: string
      } | null
      return {
        id: a.id,
        alert_type: a.alert_type,
        severity: a.severity,
        title: a.title,
        description: a.description,
        client: domain?.client ?? "",
        domain_name: domain?.domain_name ?? "Unknown",
        created_at: a.created_at,
      }
    })
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
        .from("mailbox_alerts")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("severity", "critical"),
      supabase
        .from("mailbox_alerts")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("severity", "warning"),
      supabase
        .from("mailbox_alerts")
        .select("*", { count: "exact", head: true })
        .in("status", ["resolved", "dismissed"])
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
    .from("mailbox_alerts")
    .select("alert_type")
    .order("alert_type", { ascending: true })

  if (!data) return []

  const unique = [...new Set(data.map((r) => r.alert_type))]
  return unique
})
