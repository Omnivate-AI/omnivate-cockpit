import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import type {
  LifecycleStatus,
  MailboxAccount,
} from "@/lib/types"
import type { DomainInfo, DomainHealthDay, DomainAction } from "@/lib/scoring/burn-prediction"

// --- Interfaces ---

export interface AccountListFilters {
  search?: string | null
  client?: string | null
  status?: LifecycleStatus | null
  platform?: string | null
  masterOnly?: boolean
  blockedOnly?: boolean
  sortCol?: string
  sortDir?: "asc" | "desc"
  page?: number
  pageSize?: number
}

export interface AccountListRow extends MailboxAccount {
  domain_name: string
}

export interface AccountListResult {
  accounts: AccountListRow[]
  totalCount: number
}

export interface MasterInboxCard {
  client: string
  masterAccount: {
    id: number
    email: string
    domain_name: string
    domain_id: number
    warmup_health_pct: number | null
  } | null
  accountCount: number
}

export interface ClientMailboxRow {
  id: number
  email: string
  domain_name: string
  domain_id: number
  client: string
  lifecycle_status: string
  warmup_health_pct: number | null
  platform: string | null
  campaign_ids: number[]
  max_email_per_day: number | null
  is_master_inbox: boolean
  smartlead_tags: string[]
  is_warmup_blocked: boolean
  health_checked_at: string | null
  spam_rate_pct: number | null
  reply_rate_pct: number | null
}

export interface ClientMailboxSummary {
  total: number
  byCounts: Partial<Record<string, number>>
}

// --- Constants ---

const VALID_ACCOUNT_SORT_COLS: Record<string, string> = {
  email: "email",
  client: "client",
  lifecycle_status: "lifecycle_status",
  warmup_health_pct: "warmup_health_pct",
  platform: "platform",
  updated_at: "updated_at",
}

// --- Functions ---

export const getAccountList = cache(
  async (filters: AccountListFilters): Promise<AccountListResult> => {
    const supabase = createServerClient()

    const {
      search,
      client,
      status,
      platform,
      masterOnly = false,
      blockedOnly = false,
      sortCol = "email",
      sortDir = "asc",
      page = 1,
      pageSize = 25,
    } = filters

    let query = supabase
      .from("mailbox_accounts")
      .select("*, mailbox_domains!inner(domain_name)", { count: "exact" })

    if (search) {
      query = query.or(
        `email.ilike.%${search}%,mailbox_domains.domain_name.ilike.%${search}%`
      )
    }

    if (client) {
      query = query.eq("client", client)
    }
    if (status) {
      query = query.eq("lifecycle_status", status)
    }
    if (platform) {
      query = query.eq("platform", platform)
    }
    if (masterOnly) {
      query = query.eq("is_master_inbox", true)
    }
    if (blockedOnly) {
      query = query.eq("is_warmup_blocked", true)
    }

    const dbCol = VALID_ACCOUNT_SORT_COLS[sortCol] ?? "email"
    query = query.order(dbCol, {
      ascending: sortDir === "asc",
      nullsFirst: false,
    })

    const offset = (page - 1) * pageSize
    query = query.range(offset, offset + pageSize - 1)

    const { data, count } = await query

    if (!data) {
      return { accounts: [], totalCount: 0 }
    }

    const accounts: AccountListRow[] = data.map((a) => {
      const domain = a.mailbox_domains as unknown as { domain_name: string }
      const { mailbox_domains: _, ...account } = a
      return {
        ...account,
        domain_name: domain?.domain_name ?? "",
      } as AccountListRow
    })

    return { accounts, totalCount: count ?? 0 }
  }
)

export const getMasterInboxCards = cache(
  async (): Promise<MasterInboxCard[]> => {
    const supabase = createServerClient()

    const { data: masterAccounts } = await supabase
      .from("mailbox_accounts")
      .select(
        "id, email, domain_id, client, warmup_health_pct, mailbox_domains(domain_name)"
      )
      .eq("is_master_inbox", true)

    const { data: allAccounts } = await supabase
      .from("mailbox_accounts")
      .select("client")

    const accountCounts = new Map<string, number>()
    if (allAccounts) {
      for (const a of allAccounts) {
        accountCounts.set(a.client, (accountCounts.get(a.client) ?? 0) + 1)
      }
    }

    const masterMap = new Map<string, MasterInboxCard["masterAccount"]>()
    if (masterAccounts) {
      for (const a of masterAccounts) {
        const domain = a.mailbox_domains as unknown as {
          domain_name: string
        } | null
        masterMap.set(a.client, {
          id: a.id,
          email: a.email,
          domain_name: domain?.domain_name ?? "",
          domain_id: a.domain_id,
          warmup_health_pct: a.warmup_health_pct,
        })
      }
    }

    const { CLIENTS } = await import("@/lib/types")
    return CLIENTS.map((client) => ({
      client,
      masterAccount: masterMap.get(client) ?? null,
      accountCount: accountCounts.get(client) ?? 0,
    }))
  }
)

export const getClientMailboxInventory = cache(
  async (client: string): Promise<ClientMailboxRow[]> => {
    const supabase = createServerClient()

    const { data } = await supabase
      .from("mailbox_accounts")
      .select(
        "id, email, domain_name, domain_id, client, lifecycle_status, warmup_health_pct, platform, campaign_ids, max_email_per_day, is_master_inbox, smartlead_tags, is_warmup_blocked, health_checked_at"
      )
      .eq("client", client)
      .order("email", { ascending: true })

    if (!data) return []

    // Fetch latest health snapshot per account for spam/reply rates
    const accountIds = data.map((a) => a.id)
    const healthMap = new Map<number, { spam_rate_pct: number | null; reply_rate_pct: number | null }>()

    if (accountIds.length > 0) {
      // Get latest snapshot per account using distinct on account_id ordered by snapshot_date desc
      const { data: snapshots } = await supabase
        .from("mailbox_health_snapshots")
        .select("account_id, spam_rate_pct, reply_rate_pct, snapshot_date")
        .in("account_id", accountIds)
        .not("account_id", "is", null)
        .order("snapshot_date", { ascending: false })

      if (snapshots) {
        // Take the latest snapshot per account_id
        for (const s of snapshots) {
          const aid = s.account_id as number
          if (!healthMap.has(aid)) {
            healthMap.set(aid, {
              spam_rate_pct: s.spam_rate_pct as number | null,
              reply_rate_pct: s.reply_rate_pct as number | null,
            })
          }
        }
      }
    }

    return data.map((a) => {
      const health = healthMap.get(a.id)
      return {
        ...a,
        spam_rate_pct: health?.spam_rate_pct ?? null,
        reply_rate_pct: health?.reply_rate_pct ?? null,
      } as ClientMailboxRow
    })
  }
)

export interface DomainHealthPoint {
  date: string
  avgHealth: number
}

export const getClientDomainHealthTrend = cache(
  async (client: string, days: number = 30): Promise<DomainHealthPoint[]> => {
    const supabase = createServerClient()

    // Get domain IDs for this client
    const { data: domains } = await supabase
      .from("mailbox_domains")
      .select("id")
      .eq("client", client)

    if (!domains || domains.length === 0) return []

    const domainIds = domains.map((d) => d.id)

    // Fetch domain-level health snapshots (account_id IS NULL)
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split("T")[0]

    const { data: snapshots } = await supabase
      .from("mailbox_health_snapshots")
      .select("snapshot_date, warmup_health_pct")
      .in("domain_id", domainIds)
      .is("account_id", null)
      .gte("snapshot_date", sinceStr)
      .order("snapshot_date", { ascending: true })

    if (!snapshots || snapshots.length === 0) return []

    // Group by date and compute average
    const byDate = new Map<string, number[]>()
    for (const s of snapshots) {
      const date = s.snapshot_date as string
      if (!byDate.has(date)) byDate.set(date, [])
      byDate.get(date)!.push(s.warmup_health_pct as number)
    }

    const result: DomainHealthPoint[] = []
    for (const [date, values] of byDate) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length
      result.push({ date, avgHealth: Math.round(avg * 100) / 100 })
    }

    return result
  }
)

export const getClientMailboxSummary = cache(
  async (client: string): Promise<ClientMailboxSummary> => {
    const supabase = createServerClient()

    const { data } = await supabase
      .from("mailbox_accounts")
      .select("lifecycle_status")
      .eq("client", client)

    if (!data) return { total: 0, byCounts: {} }

    const byCounts: Partial<Record<string, number>> = {}
    for (const row of data) {
      const status = row.lifecycle_status as string
      byCounts[status] = (byCounts[status] ?? 0) + 1
    }

    return { total: data.length, byCounts }
  }
)

export const getClientDomainList = cache(
  async (client: string): Promise<DomainInfo[]> => {
    const supabase = createServerClient()

    const { data } = await supabase
      .from("mailbox_domains")
      .select("id, domain_name, lifecycle_status, latest_warmup_health")
      .eq("client", client)

    if (!data) return []
    return data as DomainInfo[]
  }
)

export const getClientDomainHealthHistory = cache(
  async (client: string, days: number = 5): Promise<DomainHealthDay[]> => {
    const supabase = createServerClient()

    const { data: domains } = await supabase
      .from("mailbox_domains")
      .select("id")
      .eq("client", client)

    if (!domains || domains.length === 0) return []

    const domainIds = domains.map((d) => d.id)
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split("T")[0]

    const { data } = await supabase
      .from("mailbox_health_snapshots")
      .select("domain_id, snapshot_date, warmup_health_pct")
      .in("domain_id", domainIds)
      .is("account_id", null)
      .gte("snapshot_date", sinceStr)
      .order("snapshot_date", { ascending: false })

    if (!data) return []
    return data as DomainHealthDay[]
  }
)

export const getClientDomainActions = cache(
  async (client: string): Promise<DomainAction[]> => {
    const supabase = createServerClient()

    const { data: domains } = await supabase
      .from("mailbox_domains")
      .select("id")
      .eq("client", client)

    if (!domains || domains.length === 0) return []

    const domainIds = domains.map((d) => d.id)

    const { data } = await supabase
      .from("mailbox_actions_log")
      .select("domain_id, created_at")
      .in("domain_id", domainIds)
      .order("created_at", { ascending: false })
      .limit(100)

    if (!data) return []
    return data as DomainAction[]
  }
)

// --- New view-based queries (migration 074) ---

// Daily send capacity of a single fully-active mailbox
const DAILY_CAPACITY_PER_MAILBOX = 30

export interface ClientCapacityRow {
  client: string
  active: number
  ramping: number
  warming: number
  reserve: number
  burnt: number
  draining: number
  retired: number
  masters: number
  total: number
  avg_sending_health: number | null
  active_daily_capacity: number
  total_send_capacity: number
  out_of_service_count: number
  target_daily_volume: number | null
  buffer_pct: number
  target_active_mailboxes: number | null
  target_reserve_mailboxes: number | null
  capacity_state: "ok" | "warning" | "deficit" | "unset"
  reserve_state: "ok" | "warning" | "emergency" | "unset"
  capacity_deficit_volume: number
  reserve_deficit_count: number
  active_gap_mailboxes: number
  reserves_to_deploy: number
  reserves_remaining_after_deploy: number
  mailboxes_to_order: number
  burnt_domain_count: number
  pending_decision_count: number
  // "In service" = mailboxes tagged _active in Smartlead (deployed infrastructure,
  // whether currently sending or idle between campaigns). Includes both healthy
  // active and burnt-but-still-deployed.
  in_service_total: number
  in_service_healthy: number
  in_service_burnt: number
  in_service_daily_capacity: number
  // What capacity would be if every healthy in-service mailbox was at 30/day
  full_capacity: number
  persona_breakdown: Array<{
    persona: string | null
    in_service_total: number
    in_service_healthy: number
    in_service_burnt: number
    in_service_daily_capacity: number
  }>
}

export interface MasterInboxInfo {
  client: string
  master_email: string | null
  master_domain: string | null
  health: number | null
  exists: boolean
}

export interface BurntDomainRow {
  domain_name: string
  latest_warmup_health: number | null
  burn_detected_at: string | null
  mailbox_count: number
  has_pending_decision: boolean
}

export const getClientCapacitySnapshot = cache(
  async (client: string): Promise<ClientCapacityRow | null> => {
    const supabase = createServerClient()
    const [hs, cap, config, burntDomains, pendingDecisions, inServiceRows] = await Promise.all([
      supabase.from("v_client_health_summary").select("*").eq("client", client).maybeSingle(),
      supabase.from("v_client_capacity").select("*").eq("client", client).maybeSingle(),
      supabase.from("mailbox_clients").select("min_daily_send_volume,reserve_target_pct").eq("slug", client).maybeSingle(),
      supabase.from("v_burnt_domains_awaiting_action").select("domain_name").eq("client", client),
      supabase.from("mailbox_decisions").select("id").eq("client", client).eq("status", "pending"),
      // Fetch all non-retired mailboxes with _active tag for in-service computation
      supabase
        .from("mailbox_accounts")
        .select("persona, warmup_health_pct, max_email_per_day, smartlead_tags, lifecycle_status, is_master_inbox")
        .eq("client", client)
        .eq("is_master_inbox", false)
        .not("lifecycle_status", "in", "(retired,draining)"),
    ])
    if (!hs.data) return null

    // Compute in-service metrics from raw tags (single source of truth = Smartlead tag _active)
    type PersonaAgg = { persona: string | null; in_service_total: number; in_service_healthy: number; in_service_burnt: number; in_service_daily_capacity: number }
    const personaMap = new Map<string, PersonaAgg>()
    let inServiceTotal = 0
    let inServiceHealthy = 0
    let inServiceBurnt = 0
    let inServiceCapacity = 0
    for (const acc of inServiceRows.data ?? []) {
      const tags = (acc.smartlead_tags as string[] | null) ?? []
      const tagged = tags.some((t) => t.toLowerCase().endsWith("_active"))
      if (!tagged) continue
      const health = acc.warmup_health_pct as number | null
      const cap = (acc.max_email_per_day as number | null) ?? 0
      const isBurnt = health !== null && health < 97
      const key = (acc.persona as string | null) ?? "_"
      const entry = personaMap.get(key) ?? {
        persona: (acc.persona as string | null) ?? null,
        in_service_total: 0,
        in_service_healthy: 0,
        in_service_burnt: 0,
        in_service_daily_capacity: 0,
      }
      entry.in_service_total++
      entry.in_service_daily_capacity += cap
      if (isBurnt) entry.in_service_burnt++
      else entry.in_service_healthy++
      personaMap.set(key, entry)
      inServiceTotal++
      inServiceCapacity += cap
      if (isBurnt) inServiceBurnt++
      else inServiceHealthy++
    }
    const personaBreakdown = Array.from(personaMap.values()).sort(
      (a, b) => (b.in_service_total - a.in_service_total)
    )

    const active = hs.data.active ?? 0
    const reserve = hs.data.reserve ?? 0
    const targetDailyVolume = config.data?.min_daily_send_volume ?? null
    const bufferPct = config.data?.reserve_target_pct ? Number(config.data.reserve_target_pct) : 0.5

    const targetActiveMailboxes = targetDailyVolume
      ? Math.ceil(targetDailyVolume / DAILY_CAPACITY_PER_MAILBOX)
      : null
    const targetReserveMailboxes = targetActiveMailboxes !== null
      ? Math.ceil(targetActiveMailboxes * bufferPct)
      : null

    const activeDailyCapacity = cap.data?.active_daily_capacity ?? 0
    // Use in-service capacity (includes burnt-but-still-deployed) as the current
    // operational capacity — this reflects what's actually sending right now.
    // capacityState + mailboxes_to_order below use this value.
    const effectiveCapacity = inServiceCapacity || activeDailyCapacity

    let capacityState: ClientCapacityRow["capacity_state"] = "unset"
    let capacityDeficitVolume = 0
    if (targetDailyVolume !== null) {
      capacityDeficitVolume = Math.max(targetDailyVolume - effectiveCapacity, 0)
      if (effectiveCapacity >= targetDailyVolume) capacityState = "ok"
      else if (effectiveCapacity >= targetDailyVolume * 0.8) capacityState = "warning"
      else capacityState = "deficit"
    }

    let reserveState: ClientCapacityRow["reserve_state"] = "unset"
    let reserveDeficit = 0
    if (targetReserveMailboxes !== null) {
      reserveDeficit = Math.max(targetReserveMailboxes - reserve, 0)
      if (reserve >= targetReserveMailboxes) reserveState = "ok"
      else if (reserve >= targetReserveMailboxes * 0.6) reserveState = "warning"
      else reserveState = "emergency"
    }

    // Deployment plan: how many reserves to deploy to active, how many new to order.
    // 1. Compute active gap in mailboxes: ceil((target - active_daily) / 30)
    // 2. Deploy up to `active_gap` reserves to fill that gap
    // 3. Remaining reserves vs target_reserve tells us the restore-buffer cost
    // 4. mailboxes_to_order = unfilled active gap + reserve deficit after deploy
    let activeGapMailboxes = 0
    let reservesToDeploy = 0
    let reservesRemainingAfterDeploy = reserve
    let mailboxesToOrder = 0
    if (targetDailyVolume !== null) {
      const activeGapEmails = Math.max(0, targetDailyVolume - effectiveCapacity)
      activeGapMailboxes = Math.ceil(activeGapEmails / DAILY_CAPACITY_PER_MAILBOX)
      reservesToDeploy = Math.min(reserve, activeGapMailboxes)
      reservesRemainingAfterDeploy = reserve - reservesToDeploy
      const activeShortfallAfterDeploy = activeGapMailboxes - reservesToDeploy
      const reserveDeficitAfterDeploy = Math.max(
        0,
        (targetReserveMailboxes ?? 0) - reservesRemainingAfterDeploy
      )
      mailboxesToOrder = activeShortfallAfterDeploy + reserveDeficitAfterDeploy
    }

    return {
      client,
      active,
      ramping: hs.data.ramping ?? 0,
      warming: hs.data.warming ?? 0,
      reserve,
      burnt: hs.data.burnt ?? 0,
      draining: hs.data.draining ?? 0,
      retired: hs.data.retired ?? 0,
      masters: hs.data.masters ?? 0,
      total: hs.data.total ?? 0,
      avg_sending_health: hs.data.avg_sending_health,
      active_daily_capacity: activeDailyCapacity,
      total_send_capacity: cap.data?.total_send_capacity ?? 0,
      out_of_service_count: cap.data?.out_of_service_count ?? 0,
      target_daily_volume: targetDailyVolume,
      buffer_pct: bufferPct,
      target_active_mailboxes: targetActiveMailboxes,
      target_reserve_mailboxes: targetReserveMailboxes,
      capacity_state: capacityState,
      reserve_state: reserveState,
      capacity_deficit_volume: capacityDeficitVolume,
      reserve_deficit_count: reserveDeficit,
      active_gap_mailboxes: activeGapMailboxes,
      reserves_to_deploy: reservesToDeploy,
      reserves_remaining_after_deploy: reservesRemainingAfterDeploy,
      mailboxes_to_order: mailboxesToOrder,
      burnt_domain_count: burntDomains.data?.length ?? 0,
      pending_decision_count: pendingDecisions.data?.length ?? 0,
      in_service_total: inServiceTotal,
      in_service_healthy: inServiceHealthy,
      in_service_burnt: inServiceBurnt,
      in_service_daily_capacity: inServiceCapacity,
      full_capacity: inServiceHealthy * DAILY_CAPACITY_PER_MAILBOX,
      persona_breakdown: personaBreakdown,
    }
  }
)

export const getClientMasterInbox = cache(
  async (client: string): Promise<MasterInboxInfo> => {
    const supabase = createServerClient()
    const [mc, master] = await Promise.all([
      supabase.from("mailbox_clients").select("master_email,master_domain").eq("slug", client).maybeSingle(),
      supabase
        .from("mailbox_accounts")
        .select("email, warmup_health_pct, mailbox_domains(domain_name)")
        .eq("client", client)
        .eq("is_master_inbox", true)
        .limit(1)
        .maybeSingle(),
    ])
    const masterDomain = (master.data?.mailbox_domains as unknown as { domain_name: string } | null)?.domain_name ?? null
    return {
      client,
      master_email: mc.data?.master_email ?? master.data?.email ?? null,
      master_domain: mc.data?.master_domain ?? masterDomain,
      health: master.data?.warmup_health_pct ?? null,
      exists: !!(master.data || mc.data?.master_email),
    }
  }
)

export const getClientPersonas = cache(
  async (client: string): Promise<string[]> => {
    const supabase = createServerClient()
    const { data } = await supabase
      .from("mailbox_clients")
      .select("personas")
      .eq("slug", client)
      .maybeSingle()
    return (data?.personas as string[] | null) ?? []
  }
)

export const getClientDomainCandidateCount = cache(
  async (client: string): Promise<number> => {
    const supabase = createServerClient()
    const { count } = await supabase
      .from("mailbox_domain_candidates")
      .select("id", { count: "exact", head: true })
      .eq("client", client)
    return count ?? 0
  }
)

export const getClientBurntDomains = cache(
  async (client: string): Promise<BurntDomainRow[]> => {
    const supabase = createServerClient()
    const { data } = await supabase
      .from("v_burnt_domains_awaiting_action")
      .select("*")
      .eq("client", client)
      .order("latest_warmup_health", { ascending: true, nullsFirst: true })
    return (data ?? []) as BurntDomainRow[]
  }
)
