import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import type {
  LifecycleStatus,
  MailboxAction,
  MailboxAlert,
  MailboxDomain,
  ClientSetup,
} from "@/lib/types"

// --- Re-exported interfaces (originally from queries.ts) ---

export interface ClientStats {
  totalDomains: number
  totalAccounts: number
  avgHealth: number | null
  activeAlerts: number
}

export interface ClientBreakdownRow {
  client: string
  totalDomains: number
  totalAccounts: number
  avgHealth: number | null
  statusCounts: Partial<Record<LifecycleStatus, number>>
}

export interface ClientDomainRow extends MailboxDomain {
  account_count: number
}

export interface AlertWithDomain extends MailboxAlert {
  domain_name: string
}

export interface AuditLogRow extends MailboxAction {
  domain_name: string
  client: string
}

export interface SetupListItem extends ClientSetup {
  completed_steps: number
  total_steps: number
}

export interface SetupWithSteps extends ClientSetup {
  steps: never[]
}

// --- Functions ---

/**
 * Resolve a client slug to its child slugs (from client_analytics_config,
 * the app-owned targets/hierarchy table). If the slug has children (via
 * parent_client), returns those child slugs. Otherwise returns [slug].
 */
export const resolveClientSlugs = cache(
  async (slug: string): Promise<string[]> => {
    const supabase = createServerClient()

    const { data } = await supabase
      .from("client_analytics_config")
      .select("client")
      .eq("parent_client", slug)

    if (data && data.length > 0) {
      return data.map((row) => row.client)
    }

    return [slug]
  }
)

/**
 * Active clients = sp_clients.active (maintained by the perf/infra plugins).
 */
export const getActiveClients = cache(async (): Promise<string[]> => {
  const supabase = createServerClient()

  const { data } = await supabase
    .from("sp_clients")
    .select("slug")
    .eq("active", true)
    .order("slug", { ascending: true })

  if (!data) return []
  return data.map((row) => row.slug)
})

export interface SpClientRow {
  id: number
  slug: string
  display_name: string | null
  active: boolean
  master_email: string | null
  master_domain: string | null
  min_daily_send_volume: number | null
  reserve_target_pct: number | null
  personas: string[] | null
}

export const getSpClient = cache(
  async (slug: string): Promise<SpClientRow | null> => {
    const supabase = createServerClient()
    const { data } = await supabase
      .from("sp_clients")
      .select(
        "id, slug, display_name, active, master_email, master_domain, min_daily_send_volume, reserve_target_pct, personas"
      )
      .eq("slug", slug)
      .maybeSingle()
    return (data as SpClientRow | null) ?? null
  }
)

export const getClientStats = cache(
  async (client: string): Promise<ClientStats> => {
    const supabase = createServerClient()

    const [domainsRes, accountsRes, healthRes, alertsRes] = await Promise.all([
      supabase
        .from("vw_cockpit_domains")
        .select("*", { count: "exact", head: true })
        .eq("client", client),
      supabase
        .from("vw_cockpit_accounts")
        .select("*", { count: "exact", head: true })
        .eq("client", client),
      supabase
        .from("vw_cockpit_domains")
        .select("warmup_health_avg")
        .eq("client", client)
        .not("warmup_health_avg", "is", null),
      supabase
        .from("vw_cockpit_alerts")
        .select("*", { count: "exact", head: true })
        .eq("status", "open")
        .eq("client", client),
    ])

    let avgHealth: number | null = null
    if (healthRes.data && healthRes.data.length > 0) {
      const sum = healthRes.data.reduce(
        (acc, d) => acc + (d.warmup_health_avg ?? 0),
        0
      )
      avgHealth = sum / healthRes.data.length
    }

    return {
      totalDomains: domainsRes.count ?? 0,
      totalAccounts: accountsRes.count ?? 0,
      avgHealth,
      activeAlerts: alertsRes.count ?? 0,
    }
  }
)

/**
 * Onboarding is disabled in this build (no sp_* backend for client_setups).
 * Returning null means the client page never shows the setup gate.
 */
export const getSetupBySlug = cache(
  async (_slug: string): Promise<ClientSetup | null> => null
)

export const getClientBreakdown = cache(
  async (client?: string | null): Promise<ClientBreakdownRow[]> => {
    const supabase = createServerClient()

    let domainQuery = supabase
      .from("vw_cockpit_domains")
      .select("client, lifecycle_status, warmup_health_avg, account_count")

    if (client) {
      domainQuery = domainQuery.eq("client", client)
    }

    const { data: domains } = await domainQuery

    // Group by client
    const clientMap = new Map<
      string,
      {
        totalDomains: number
        totalAccounts: number
        healthValues: number[]
        statusCounts: Partial<Record<LifecycleStatus, number>>
      }
    >()

    for (const d of domains ?? []) {
      if (!d.client) continue
      if (!clientMap.has(d.client)) {
        clientMap.set(d.client, {
          totalDomains: 0,
          totalAccounts: 0,
          healthValues: [],
          statusCounts: {},
        })
      }
      const entry = clientMap.get(d.client)!
      entry.totalDomains++
      entry.totalAccounts += d.account_count ?? 0
      if (d.warmup_health_avg != null) {
        entry.healthValues.push(d.warmup_health_avg)
      }
      const status = d.lifecycle_status as LifecycleStatus
      entry.statusCounts[status] = (entry.statusCounts[status] ?? 0) + 1
    }

    const rows: ClientBreakdownRow[] = []
    for (const [clientName, data] of clientMap) {
      rows.push({
        client: clientName,
        totalDomains: data.totalDomains,
        totalAccounts: data.totalAccounts,
        avgHealth:
          data.healthValues.length > 0
            ? data.healthValues.reduce((a, b) => a + b, 0) /
              data.healthValues.length
            : null,
        statusCounts: data.statusCounts,
      })
    }

    rows.sort((a, b) => a.client.localeCompare(b.client))

    return rows
  }
)

export const getClientDomains = cache(
  async (client: string): Promise<ClientDomainRow[]> => {
    const supabase = createServerClient()

    const { data } = await supabase
      .from("vw_cockpit_domains")
      .select("*")
      .eq("client", client)
      .order("warmup_health_avg", { ascending: true, nullsFirst: false })

    return (data ?? []) as ClientDomainRow[]
  }
)

export const getClientHealthTrend = cache(
  async (
    client: string,
    days: number = 30
  ): Promise<{ date: string; avgHealth: number }[]> => {
    const supabase = createServerClient()

    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data } = await supabase
      .from("vw_cockpit_domain_health_daily")
      .select("snapshot_date, avg_health_pct")
      .eq("client", client)
      .gte("snapshot_date", since.toISOString().split("T")[0])
      .order("snapshot_date", { ascending: true })

    if (!data || data.length === 0) return []

    // Aggregate by date: average across all domains per day
    const dateMap = new Map<string, { sum: number; count: number }>()
    for (const s of data) {
      if (s.avg_health_pct == null) continue
      const existing = dateMap.get(s.snapshot_date)
      if (existing) {
        existing.sum += s.avg_health_pct
        existing.count++
      } else {
        dateMap.set(s.snapshot_date, { sum: s.avg_health_pct, count: 1 })
      }
    }

    return [...dateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { sum, count }]) => ({
        date,
        avgHealth: sum / count,
      }))
  }
)

export const getClientAlerts = cache(
  async (
    client: string,
    resolved: boolean,
    limit: number = 5
  ): Promise<AlertWithDomain[]> => {
    const supabase = createServerClient()

    const { data } = await supabase
      .from("vw_cockpit_alerts")
      .select("*")
      .eq("client", client)
      .eq("status", resolved ? "resolved" : "open")
      .order("created_at", { ascending: false })
      .limit(limit)

    return ((data ?? []) as AlertWithDomain[]).map((a) => ({
      ...a,
      domain_name: a.domain_name ?? "—",
    }))
  }
)

export const getClientActions = cache(
  async (client: string, limit: number = 10): Promise<AuditLogRow[]> => {
    const supabase = createServerClient()

    const { data } = await supabase
      .from("vw_cockpit_actions")
      .select("*")
      .eq("client", client)
      .order("created_at", { ascending: false })
      .limit(limit)

    return ((data ?? []) as AuditLogRow[]).map((a) => ({
      ...a,
      domain_name: a.domain_name ?? "—",
    }))
  }
)

// --- Onboarding queries (disabled in this build — no sp_* backend) ---

export const getAllSetups = cache(async (): Promise<SetupListItem[]> => [])

export const getSetupById = cache(
  async (_id: number): Promise<ClientSetup | null> => null
)

export const getSetupWithSteps = cache(
  async (_id: number): Promise<SetupWithSteps | null> => null
)
