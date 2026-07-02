import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import type {
  LifecycleStatus,
  MailboxAccount,
  MailboxAction,
  MailboxAlert,
  MailboxDomain,
  HealthSnapshot,
  ClientSetup,
  SetupStep,
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
  client: string
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
  steps: SetupStep[]
}

// --- Functions ---

/**
 * Resolve a client slug to its child slugs (from client_analytics_config).
 * If the slug has children (via parent_client), returns those child slugs.
 * Otherwise returns [slug] itself.
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

export const getActiveClients = cache(async (): Promise<string[]> => {
  const supabase = createServerClient()

  const { data } = await supabase
    .from("client_setups")
    .select("client_slug")
    .not("status", "in", '("draft","failed")')
    .order("client_slug", { ascending: true })

  if (!data) return []
  return data.map((row) => row.client_slug)
})

export const getClientStats = cache(
  async (client: string): Promise<ClientStats> => {
    const supabase = createServerClient()

    const [domainsRes, accountsRes, healthRes, alertsRes] = await Promise.all([
      supabase
        .from("mailbox_domains")
        .select("*", { count: "exact", head: true })
        .eq("client", client),
      supabase
        .from("mailbox_accounts")
        .select("*", { count: "exact", head: true })
        .eq("client", client),
      supabase
        .from("mailbox_domains")
        .select("warmup_health_avg")
        .eq("client", client)
        .not("warmup_health_avg", "is", null),
      supabase
        .from("mailbox_alerts")
        .select("*, mailbox_domains!inner(client)")
        .eq("status", "pending")
        .eq("mailbox_domains.client", client),
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
      activeAlerts: alertsRes.data?.length ?? 0,
    }
  }
)

export const getSetupBySlug = cache(
  async (slug: string): Promise<ClientSetup | null> => {
    const supabase = createServerClient()
    const { data } = await supabase
      .from("client_setups")
      .select("*")
      .eq("client_slug", slug)
      .single()
    return data as ClientSetup | null
  }
)

export const getClientBreakdown = cache(
  async (client?: string | null): Promise<ClientBreakdownRow[]> => {
    const supabase = createServerClient()

    let domainQuery = supabase
      .from("mailbox_domains")
      .select("client, lifecycle_status, warmup_health_avg")
    let accountQuery = supabase.from("mailbox_accounts").select("client")

    if (client) {
      domainQuery = domainQuery.eq("client", client)
      accountQuery = accountQuery.eq("client", client)
    }

    const [domainsRes, accountsRes] = await Promise.all([
      domainQuery,
      accountQuery,
    ])

    const domains = domainsRes.data ?? []
    const accounts = accountsRes.data ?? []

    // Group by client
    const clientMap = new Map<
      string,
      {
        totalDomains: number
        healthValues: number[]
        statusCounts: Partial<Record<LifecycleStatus, number>>
      }
    >()

    for (const d of domains) {
      if (!clientMap.has(d.client)) {
        clientMap.set(d.client, {
          totalDomains: 0,
          healthValues: [],
          statusCounts: {},
        })
      }
      const entry = clientMap.get(d.client)!
      entry.totalDomains++
      if (d.warmup_health_avg != null) {
        entry.healthValues.push(d.warmup_health_avg)
      }
      const status = d.lifecycle_status as LifecycleStatus
      entry.statusCounts[status] = (entry.statusCounts[status] ?? 0) + 1
    }

    // Count accounts per client
    const accountCounts = new Map<string, number>()
    for (const a of accounts) {
      accountCounts.set(a.client, (accountCounts.get(a.client) ?? 0) + 1)
    }

    const rows: ClientBreakdownRow[] = []
    for (const [clientName, data] of clientMap) {
      rows.push({
        client: clientName,
        totalDomains: data.totalDomains,
        totalAccounts: accountCounts.get(clientName) ?? 0,
        avgHealth:
          data.healthValues.length > 0
            ? data.healthValues.reduce((a, b) => a + b, 0) /
              data.healthValues.length
            : null,
        statusCounts: data.statusCounts,
      })
    }

    // Sort by client name
    rows.sort((a, b) => a.client.localeCompare(b.client))

    return rows
  }
)

export const getClientDomains = cache(
  async (client: string): Promise<ClientDomainRow[]> => {
    const supabase = createServerClient()

    const { data } = await supabase
      .from("mailbox_domains")
      .select("*, mailbox_accounts(count)")
      .eq("client", client)
      .order("warmup_health_avg", { ascending: true, nullsFirst: false })

    if (!data) return []

    return data.map((d) => {
      const accountArr = d.mailbox_accounts as unknown as { count: number }[]
      const account_count = accountArr?.[0]?.count ?? 0
      const { mailbox_accounts: _, ...domain } = d
      return { ...domain, account_count } as ClientDomainRow
    })
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
      .from("mailbox_health_snapshots")
      .select(
        "snapshot_date, avg_health_pct, mailbox_domains!inner(client)"
      )
      .eq("mailbox_domains.client", client)
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
      .from("mailbox_alerts")
      .select("*, mailbox_domains(domain_name, client)")
      .eq("status", resolved ? "resolved" : "pending")
      .order("created_at", { ascending: false })
      .limit(limit * 3) // over-fetch since we filter post-fetch

    if (!data) return []

    return data
      .map((a) => {
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
      .filter((a) => a.client === client)
      .slice(0, limit)
  }
)

export const getClientActions = cache(
  async (client: string, limit: number = 10): Promise<AuditLogRow[]> => {
    const supabase = createServerClient()

    const { data } = await supabase
      .from("mailbox_actions_log")
      .select("*, mailbox_domains(domain_name, client)")
      .order("created_at", { ascending: false })
      .limit(limit * 3) // over-fetch since we filter post-fetch

    if (!data) return []

    return data
      .map((a) => {
        const domain = a.mailbox_domains as unknown as {
          domain_name: string
          client: string
        } | null
        const { mailbox_domains: _, ...rest } = a
        return {
          ...rest,
          domain_name: domain?.domain_name ?? "Unknown",
          client: domain?.client ?? "",
        } as AuditLogRow
      })
      .filter((a) => a.client === client)
      .slice(0, limit)
  }
)

// --- Onboarding queries ---

export const getAllSetups = cache(async (): Promise<SetupListItem[]> => {
  const supabase = createServerClient()

  const { data: setups } = await supabase
    .from("client_setups")
    .select("*")
    .order("created_at", { ascending: false })

  if (!setups || setups.length === 0) return []

  // Fetch step counts per setup
  const setupIds = setups.map((s) => s.id)
  const { data: steps } = await supabase
    .from("setup_steps")
    .select("setup_id, status")
    .in("setup_id", setupIds)

  // Build step count maps
  const totalMap = new Map<number, number>()
  const completedMap = new Map<number, number>()
  if (steps) {
    for (const s of steps) {
      totalMap.set(s.setup_id, (totalMap.get(s.setup_id) ?? 0) + 1)
      if (s.status === "completed") {
        completedMap.set(
          s.setup_id,
          (completedMap.get(s.setup_id) ?? 0) + 1
        )
      }
    }
  }

  return (setups as ClientSetup[]).map((setup) => ({
    ...setup,
    completed_steps: completedMap.get(setup.id) ?? 0,
    total_steps: totalMap.get(setup.id) ?? 10,
  }))
})

export const getSetupById = cache(
  async (id: number): Promise<ClientSetup | null> => {
    const supabase = createServerClient()
    const { data } = await supabase
      .from("client_setups")
      .select("*")
      .eq("id", id)
      .single()
    return data as ClientSetup | null
  }
)

export const getSetupWithSteps = cache(
  async (id: number): Promise<SetupWithSteps | null> => {
    const supabase = createServerClient()

    const { data: setup } = await supabase
      .from("client_setups")
      .select("*")
      .eq("id", id)
      .single()

    if (!setup) return null

    const { data: steps } = await supabase
      .from("setup_steps")
      .select("*")
      .eq("setup_id", id)
      .order("id", { ascending: true })

    return {
      ...(setup as ClientSetup),
      steps: (steps ?? []) as SetupStep[],
    }
  }
)
