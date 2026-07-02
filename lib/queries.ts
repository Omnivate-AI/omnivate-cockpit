import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import type {
  LifecycleStatus,
  MailboxAccount,
  MailboxAction,
  MailboxDomain,
  HealthSnapshot,
} from "@/lib/types"

// Re-export everything from new modular query files
export * from "./queries/clients"
export * from "./queries/analytics"
export * from "./queries/campaigns"
export * from "./queries/mailboxes"
export * from "./queries/alerts"
export * from "./queries/pipelines"

// Import types needed locally from modules
import type { AuditLogRow } from "./queries/clients"

// --- Interfaces for functions that remain here ---

export interface DashboardStats {
  totalDomains: number
  totalAccounts: number
  avgHealth: number | null
  activeAlerts: number
}

export interface StatusDistributionItem {
  status: LifecycleStatus
  count: number
}

export interface DomainListFilters {
  client?: string | null
  statuses?: LifecycleStatus[]
  healthFilter?: "all" | "healthy" | "warning" | "critical"
  sortCol?: string
  sortDir?: "asc" | "desc"
  page?: number
  pageSize?: number
}

export interface DomainListRow extends MailboxDomain {
  account_count: number
}

export interface DomainListResult {
  domains: DomainListRow[]
  totalCount: number
}

export interface HealthTrendPoint {
  snapshot_date: string
  domain_name: string
  client: string
  domain_id: number
  avg_health_pct: number | null
}

export interface DomainHealthCard {
  id: number
  domain_name: string
  client: string
  lifecycle_status: LifecycleStatus
  current_health: number | null
  previous_health: number | null
}

export interface HealthAggregates {
  healthy: number
  warning: number
  critical: number
}

export interface EligibleAccount {
  id: number
  email: string
  domain_id: number
  domain_name: string
  warmup_health_pct: number | null
  domain_health: number | null
  is_master_inbox: boolean
}

export interface AuditLogFilters {
  actionType?: string | null
  client?: string | null
  status?: string | null
  dateRange?: "7" | "30" | "90" | "all" | null
  page?: number
  pageSize?: number
}

export interface AuditLogResult {
  actions: AuditLogRow[]
  totalCount: number
}

export interface SettingsPageData {
  burnThreshold: number
  totalDomains: number
  totalAccounts: number
  lastSync: string | null
}

// --- Remaining functions (not moved to modules yet) ---

export const getDashboardStats = cache(
  async (client?: string | null): Promise<DashboardStats> => {
    const supabase = createServerClient()

    let domainQuery = supabase
      .from("vw_cockpit_domains")
      .select("*", { count: "exact", head: true })
    let accountQuery = supabase
      .from("vw_cockpit_accounts")
      .select("*", { count: "exact", head: true })
    let healthQuery = supabase
      .from("vw_cockpit_domains")
      .select("warmup_health_avg")
      .not("warmup_health_avg", "is", null)
    let alertQuery = supabase
      .from("vw_cockpit_alerts")
      .select("*", { count: "exact", head: true })
      .eq("status", "open")

    if (client) {
      domainQuery = domainQuery.eq("client", client)
      accountQuery = accountQuery.eq("client", client)
      healthQuery = healthQuery.eq("client", client)
      alertQuery = alertQuery.eq("client", client)
    }

    const [domains, accounts, health, alerts] = await Promise.all([
      domainQuery,
      accountQuery,
      healthQuery,
      alertQuery,
    ])

    let avgHealth: number | null = null
    if (health.data && health.data.length > 0) {
      const sum = health.data.reduce(
        (acc, d) => acc + (d.warmup_health_avg ?? 0),
        0
      )
      avgHealth = sum / health.data.length
    }

    return {
      totalDomains: domains.count ?? 0,
      totalAccounts: accounts.count ?? 0,
      avgHealth,
      activeAlerts: alerts.count ?? 0,
    }
  }
)

export const getStatusDistribution = cache(
  async (client?: string | null): Promise<StatusDistributionItem[]> => {
    const supabase = createServerClient()

    let query = supabase.from("vw_cockpit_domains").select("lifecycle_status")
    if (client) {
      query = query.eq("client", client)
    }

    const { data } = await query
    if (!data) return []

    const counts = new Map<LifecycleStatus, number>()
    for (const d of data) {
      const status = d.lifecycle_status as LifecycleStatus
      counts.set(status, (counts.get(status) ?? 0) + 1)
    }

    return Array.from(counts.entries()).map(([status, count]) => ({
      status,
      count,
    }))
  }
)

// --- Domain List Queries ---

const VALID_SORT_COLS: Record<string, string> = {
  domain_name: "domain_name",
  client: "client",
  lifecycle_status: "lifecycle_status",
  warmup_health_avg: "warmup_health_avg",
  platform: "platform",
  updated_at: "updated_at",
}

export const getDomainList = cache(
  async (filters: DomainListFilters): Promise<DomainListResult> => {
    const supabase = createServerClient()

    const {
      client,
      statuses,
      healthFilter,
      sortCol = "domain_name",
      sortDir = "asc",
      page = 1,
      pageSize = 25,
    } = filters

    let query = supabase
      .from("vw_cockpit_domains")
      .select("*", { count: "exact" })

    if (client) {
      query = query.eq("client", client)
    }
    if (statuses && statuses.length > 0) {
      query = query.in("lifecycle_status", statuses)
    }
    if (healthFilter && healthFilter !== "all") {
      switch (healthFilter) {
        case "healthy":
          query = query.gte("warmup_health_avg", 95)
          break
        case "warning":
          query = query
            .gte("warmup_health_avg", 85)
            .lt("warmup_health_avg", 95)
          break
        case "critical":
          query = query.lt("warmup_health_avg", 85)
          break
      }
    }

    const dbCol = VALID_SORT_COLS[sortCol] ?? "domain_name"
    query = query.order(dbCol, {
      ascending: sortDir === "asc",
      nullsFirst: false,
    })

    const offset = (page - 1) * pageSize
    query = query.range(offset, offset + pageSize - 1)

    const { data, count } = await query

    if (!data) {
      return { domains: [], totalCount: 0 }
    }

    return { domains: data as DomainListRow[], totalCount: count ?? 0 }
  }
)

// --- Domain Detail Queries ---

export const getDomainById = cache(
  async (id: number): Promise<MailboxDomain | null> => {
    const supabase = createServerClient()
    const { data } = await supabase
      .from("vw_cockpit_domains")
      .select("*")
      .eq("id", id)
      .single()
    return data as MailboxDomain | null
  }
)

export const getDomainAccounts = cache(
  async (domainId: number): Promise<MailboxAccount[]> => {
    const supabase = createServerClient()
    const { data } = await supabase
      .from("vw_cockpit_accounts")
      .select("*")
      .eq("domain_id", domainId)
      .order("email", { ascending: true })
    return (data ?? []) as MailboxAccount[]
  }
)

export const getDomainSnapshots = cache(
  async (domainId: number, days: number = 30): Promise<HealthSnapshot[]> => {
    const supabase = createServerClient()
    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data } = await supabase
      .from("vw_cockpit_domain_health_daily")
      .select("*")
      .eq("domain_id", domainId)
      .gte("snapshot_date", since.toISOString().split("T")[0])
      .order("snapshot_date", { ascending: true })
    return (data ?? []) as HealthSnapshot[]
  }
)

export const getDomainActions = cache(
  async (domainId: number): Promise<MailboxAction[]> => {
    const supabase = createServerClient()
    const { data } = await supabase
      .from("vw_cockpit_actions")
      .select("*")
      .eq("domain_id", domainId)
      .order("created_at", { ascending: false })
      .limit(50)
    return (data ?? []) as MailboxAction[]
  }
)

// --- Health Monitoring Queries ---

export const getHealthTrends = cache(
  async (
    days: number = 30,
    client?: string | null
  ): Promise<HealthTrendPoint[]> => {
    const supabase = createServerClient()

    const since = new Date()
    since.setDate(since.getDate() - days)

    let query = supabase
      .from("vw_cockpit_domain_health_daily")
      .select("snapshot_date, avg_health_pct, domain_id, domain_name, client")
      .gte("snapshot_date", since.toISOString().split("T")[0])
      .order("snapshot_date", { ascending: true })

    if (client) {
      query = query.eq("client", client)
    }

    const { data } = await query

    return ((data ?? []) as HealthTrendPoint[]).map((s) => ({
      ...s,
      domain_name: s.domain_name ?? "Unknown",
      client: s.client ?? "",
    }))
  }
)

export const getDomainHealthCards = cache(
  async (client?: string | null): Promise<DomainHealthCard[]> => {
    const supabase = createServerClient()

    let domainQuery = supabase
      .from("vw_cockpit_domains")
      .select("id, domain_name, client, lifecycle_status, warmup_health_avg")
    if (client) {
      domainQuery = domainQuery.eq("client", client)
    }

    const { data: domains } = await domainQuery
    if (!domains) return []

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const compareDate = sevenDaysAgo.toISOString().split("T")[0]

    const domainIds = domains.map((d) => d.id)
    if (domainIds.length === 0) return []

    const { data: oldSnapshots } = await supabase
      .from("vw_cockpit_domain_health_daily")
      .select("domain_id, avg_health_pct, snapshot_date")
      .in("domain_id", domainIds)
      .lte("snapshot_date", compareDate)
      .order("snapshot_date", { ascending: false })

    const previousHealthMap = new Map<number, number | null>()
    if (oldSnapshots) {
      for (const s of oldSnapshots) {
        if (!previousHealthMap.has(s.domain_id)) {
          previousHealthMap.set(s.domain_id, s.avg_health_pct)
        }
      }
    }

    const cards: DomainHealthCard[] = domains.map((d) => ({
      id: d.id,
      domain_name: d.domain_name,
      client: d.client,
      lifecycle_status: d.lifecycle_status as LifecycleStatus,
      current_health: d.warmup_health_avg,
      previous_health: previousHealthMap.get(d.id) ?? null,
    }))

    cards.sort((a, b) => {
      const ah = a.current_health ?? -1
      const bh = b.current_health ?? -1
      return ah - bh
    })

    return cards
  }
)

export const getHealthAggregates = cache(
  async (client?: string | null): Promise<HealthAggregates> => {
    const supabase = createServerClient()

    let query = supabase
      .from("vw_cockpit_domains")
      .select("warmup_health_avg")
      .not("warmup_health_avg", "is", null)
    if (client) {
      query = query.eq("client", client)
    }

    const { data } = await query
    if (!data) return { healthy: 0, warning: 0, critical: 0 }

    let healthy = 0
    let warning = 0
    let critical = 0

    for (const d of data) {
      const h = d.warmup_health_avg as number
      if (h >= 97) healthy++
      else if (h >= 85) warning++
      else critical++
    }

    return { healthy, warning, critical }
  }
)

export const getBurnThreshold = cache(async (): Promise<number> => {
  const supabase = createServerClient()
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "burn_threshold")
    .single()
  return data ? Number(data.value) : 97
})

// --- Rotation Queries ---

export const getMasterInboxEmail = cache(
  async (client: string): Promise<string | null> => {
    const supabase = createServerClient()
    const { data } = await supabase
      .from("vw_cockpit_accounts")
      .select("email")
      .eq("client", client)
      .eq("is_master_inbox", true)
      .limit(1)
      .maybeSingle()
    return data?.email ?? null
  }
)

export const getEligibleAccounts = cache(
  async (client: string): Promise<EligibleAccount[]> => {
    const supabase = createServerClient()

    const { data } = await supabase
      .from("vw_cockpit_accounts")
      .select(
        "id, email, domain_id, domain_name, warmup_health_pct, is_master_inbox, lifecycle_status"
      )
      .eq("client", client)
      .in("lifecycle_status", ["active", "reserve"])
      .gt("warmup_health_pct", 90)
      .order("email", { ascending: true })

    if (!data) return []

    return data.map((a) => ({
      id: a.id,
      email: a.email,
      domain_id: a.domain_id ?? 0,
      domain_name: a.domain_name ?? "",
      warmup_health_pct: a.warmup_health_pct,
      domain_health: null,
      is_master_inbox: a.is_master_inbox,
    }))
  }
)

// --- Audit Log Queries ---

export const getAuditLog = cache(
  async (filters: AuditLogFilters): Promise<AuditLogResult> => {
    const supabase = createServerClient()

    const {
      actionType,
      client,
      status,
      dateRange,
      page = 1,
      pageSize = 25,
    } = filters

    let query = supabase
      .from("vw_cockpit_actions")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })

    if (actionType) {
      query = query.eq("action_type", actionType)
    }
    if (status) {
      query = query.eq("status", status)
    }
    if (client) {
      query = query.eq("client", client)
    }
    if (dateRange && dateRange !== "all") {
      const since = new Date()
      since.setDate(since.getDate() - Number(dateRange))
      query = query.gte("created_at", since.toISOString())
    }

    const offset = (page - 1) * pageSize
    query = query.range(offset, offset + pageSize - 1)

    const { data, count } = await query

    if (!data) {
      return { actions: [], totalCount: 0 }
    }

    const actions: AuditLogRow[] = (data as AuditLogRow[]).map((a) => ({
      ...a,
      domain_name: a.domain_name ?? "—",
      client: a.client ?? "",
    }))

    return { actions, totalCount: count ?? 0 }
  }
)

export const getAuditLogForExport = cache(
  async (
    filters: Omit<AuditLogFilters, "page" | "pageSize">
  ): Promise<AuditLogRow[]> => {
    const supabase = createServerClient()

    const { actionType, client, status, dateRange } = filters

    let query = supabase
      .from("vw_cockpit_actions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000)

    if (actionType) {
      query = query.eq("action_type", actionType)
    }
    if (status) {
      query = query.eq("status", status)
    }
    if (client) {
      query = query.eq("client", client)
    }
    if (dateRange && dateRange !== "all") {
      const since = new Date()
      since.setDate(since.getDate() - Number(dateRange))
      query = query.gte("created_at", since.toISOString())
    }

    const { data } = await query

    if (!data) return []

    return (data as AuditLogRow[]).map((a) => ({
      ...a,
      domain_name: a.domain_name ?? "—",
      client: a.client ?? "",
    }))
  }
)

// --- Settings Page Queries ---

export const getSettingsPageData = cache(
  async (): Promise<SettingsPageData> => {
    const supabase = createServerClient()

    const [thresholdRes, domainsRes, accountsRes, freshnessRes] =
      await Promise.all([
        supabase
          .from("app_settings")
          .select("value")
          .eq("key", "burn_threshold")
          .single(),
        supabase
          .from("vw_cockpit_domains")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("vw_cockpit_accounts")
          .select("*", { count: "exact", head: true }),
        supabase.from("vw_cockpit_freshness").select("*").single(),
      ])

    return {
      burnThreshold: thresholdRes.data ? Number(thresholdRes.data.value) : 97,
      totalDomains: domainsRes.count ?? 0,
      totalAccounts: accountsRes.count ?? 0,
      lastSync: freshnessRes.data?.last_sync_at ?? null,
    }
  }
)

// --- Freshness (global "data as-of") ---

export interface FreshnessInfo {
  lastSyncAt: string | null
  latestFactDate: string | null
  latestSendEventAt: string | null
  latestReplyAt: string | null
}

export const getFreshness = cache(async (): Promise<FreshnessInfo> => {
  const supabase = createServerClient()
  const { data } = await supabase
    .from("vw_cockpit_freshness")
    .select("*")
    .single()

  return {
    lastSyncAt: data?.last_sync_at ?? null,
    latestFactDate: data?.latest_fact_date ?? null,
    latestSendEventAt: data?.latest_send_event_at ?? null,
    latestReplyAt: data?.latest_reply_at ?? null,
  }
})
