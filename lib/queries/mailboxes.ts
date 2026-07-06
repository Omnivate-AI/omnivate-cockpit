import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import type { LifecycleStatus, MailboxAccount } from "@/lib/types"
import type { DomainInfo, DomainHealthDay, DomainAction } from "@/lib/scoring/burn-prediction"
import { getActiveClients } from "@/lib/queries/clients"

// Infra reads come from:
//   vw_cockpit_accounts   (sp_mailboxes via provider-normalized vw_sp_mailboxes + roster)
//   vw_cockpit_domains    (sp_domains + live account counts)
//   vw_cockpit_client_health_summary / vw_cockpit_client_capacity
//   vw_cockpit_domain_health_daily (per-domain daily warmup from sp_daily_mailbox_facts)
//   vw_cockpit_mailbox_rates (latest placement spam % + 30d reply rate per box)
//   vw_cockpit_burnt_domains, sp_domain_candidates, sp_decisions, sp_clients

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
  domain_id: number | null
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

// Planning divisor for "how many mailboxes does a volume target need".
// Pool policy is 25/day Gmail, 20/day Outlook — 25 is the optimistic divisor;
// real capacity always comes from summing max_email_per_day.
const DAILY_CAPACITY_PER_MAILBOX = 25

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
      .from("vw_cockpit_accounts")
      .select("*", { count: "exact" })

    if (search) {
      query = query.or(`email.ilike.%${search}%,domain_name.ilike.%${search}%`)
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

    const accounts: AccountListRow[] = (data as AccountListRow[]).map((a) => ({
      ...a,
      domain_name: a.domain_name ?? "",
    }))

    return { accounts, totalCount: count ?? 0 }
  }
)

export const getMasterInboxCards = cache(
  async (): Promise<MasterInboxCard[]> => {
    const supabase = createServerClient()
    const clients = await getActiveClients()

    const [{ data: masterAccounts }, { data: allAccounts }] = await Promise.all([
      supabase
        .from("vw_cockpit_accounts")
        .select("id, email, domain_id, domain_name, client, warmup_health_pct")
        .eq("is_master_inbox", true),
      supabase.from("vw_cockpit_accounts").select("client"),
    ])

    const accountCounts = new Map<string, number>()
    for (const a of allAccounts ?? []) {
      if (!a.client) continue
      accountCounts.set(a.client, (accountCounts.get(a.client) ?? 0) + 1)
    }

    const masterMap = new Map<string, MasterInboxCard["masterAccount"]>()
    for (const a of masterAccounts ?? []) {
      if (!a.client) continue
      masterMap.set(a.client, {
        id: a.id,
        email: a.email,
        domain_name: a.domain_name ?? "",
        domain_id: a.domain_id ?? 0,
        warmup_health_pct: a.warmup_health_pct,
      })
    }

    return clients.map((client) => ({
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
      .from("vw_cockpit_accounts")
      .select(
        "id, email, domain_name, domain_id, client, lifecycle_status, warmup_health_pct, platform, campaign_ids, max_email_per_day, is_master_inbox, smartlead_tags, is_warmup_blocked, health_checked_at"
      )
      .eq("client", client)
      .order("email", { ascending: true })

    if (!data) return []

    // Latest placement spam % + 30d reply rate per mailbox
    const accountIds = data.map((a) => a.id)
    const rateMap = new Map<
      number,
      { spam_rate_pct: number | null; reply_rate_pct: number | null }
    >()

    if (accountIds.length > 0) {
      const { data: rates } = await supabase
        .from("vw_cockpit_mailbox_rates")
        .select("account_id, spam_rate_pct, reply_rate_pct")
        .in("account_id", accountIds)

      for (const r of rates ?? []) {
        rateMap.set(r.account_id, {
          spam_rate_pct: r.spam_rate_pct,
          reply_rate_pct: r.reply_rate_pct,
        })
      }
    }

    return data.map((a) => {
      const rates = rateMap.get(a.id)
      return {
        ...a,
        domain_name: a.domain_name ?? "",
        smartlead_tags: (a.smartlead_tags as string[] | null) ?? [],
        campaign_ids: (a.campaign_ids as number[] | null) ?? [],
        spam_rate_pct: rates?.spam_rate_pct ?? null,
        reply_rate_pct: rates?.reply_rate_pct ?? null,
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

    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split("T")[0]

    const { data: snapshots } = await supabase
      .from("vw_cockpit_domain_health_daily")
      .select("snapshot_date, warmup_health_pct")
      .eq("client", client)
      .gte("snapshot_date", sinceStr)
      .order("snapshot_date", { ascending: true })

    if (!snapshots || snapshots.length === 0) return []

    const byDate = new Map<string, number[]>()
    for (const s of snapshots) {
      if (s.warmup_health_pct == null) continue
      const date = s.snapshot_date as string
      if (!byDate.has(date)) byDate.set(date, [])
      byDate.get(date)!.push(Number(s.warmup_health_pct))
    }

    const result: DomainHealthPoint[] = []
    for (const [date, values] of byDate) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length
      result.push({ date, avgHealth: Math.round(avg * 100) / 100 })
    }

    return result.sort((a, b) => a.date.localeCompare(b.date))
  }
)

export const getClientMailboxSummary = cache(
  async (client: string): Promise<ClientMailboxSummary> => {
    const supabase = createServerClient()

    const { data } = await supabase
      .from("vw_cockpit_accounts")
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
      .from("vw_cockpit_domains")
      .select("id, domain_name, lifecycle_status, latest_warmup_health")
      .eq("client", client)

    if (!data) return []
    return data as DomainInfo[]
  }
)

export const getClientDomainHealthHistory = cache(
  async (client: string, days: number = 5): Promise<DomainHealthDay[]> => {
    const supabase = createServerClient()

    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split("T")[0]

    const { data } = await supabase
      .from("vw_cockpit_domain_health_daily")
      .select("domain_id, snapshot_date, warmup_health_pct")
      .eq("client", client)
      .gte("snapshot_date", sinceStr)
      .order("snapshot_date", { ascending: false })

    if (!data) return []
    return data as DomainHealthDay[]
  }
)

export const getClientDomainActions = cache(
  async (client: string): Promise<DomainAction[]> => {
    const supabase = createServerClient()

    const { data } = await supabase
      .from("vw_cockpit_actions")
      .select("domain_id, created_at")
      .eq("client", client)
      .not("domain_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(100)

    if (!data) return []
    return data as DomainAction[]
  }
)

// --- Capacity snapshot (per-client infra overview) ---

export interface ClientCapacityRow {
  client: string
  active: number
  ramping: number
  warming: number
  reserve: number
  resting: number
  parked: number
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
  // Boxes below the 97% burn threshold on an in-play lifecycle (not
  // retired/parked/burnt/master) — same definition as the Command Center
  // at-risk metric (vw_cockpit_portfolio_health). THE action-now number:
  // a box can be effectively burnt while its lifecycle still says "active"
  // (burnt lifecycle is only stamped at rotation). Omar 2026-07-06: the
  // burnt card showed 0 while two 81% boxes were still sending.
  at_risk_in_play: number
  in_service_daily_capacity: number
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

// A/B weekly-rotation capacity (vw_cockpit_rotation_capacity, migration 011)
export interface RotationCapacityRow {
  client: string
  group_a_boxes: number
  group_a_capacity: number
  group_a_active_boxes: number
  group_b_boxes: number
  group_b_capacity: number
  group_b_active_boxes: number
  pool_boxes: number
  pool_capacity: number
  reserve_boxes: number
  reserve_capacity: number
  warming_boxes: number
  ungrouped_pool_boxes: number
}

export const getClientRotationCapacity = cache(
  async (client: string): Promise<RotationCapacityRow | null> => {
    const supabase = createServerClient()
    const { data } = await supabase
      .from("vw_cockpit_rotation_capacity")
      .select("*")
      .eq("client", client)
      .maybeSingle()
    return (data as RotationCapacityRow | null) ?? null
  }
)

export const getClientCapacitySnapshot = cache(
  async (client: string): Promise<ClientCapacityRow | null> => {
    const supabase = createServerClient()
    const [hs, cap, config, burntDomains, pendingDecisions, inServiceRows] =
      await Promise.all([
        supabase
          .from("vw_cockpit_client_health_summary")
          .select("*")
          .eq("client", client)
          .maybeSingle(),
        supabase
          .from("vw_cockpit_client_capacity")
          .select("*")
          .eq("client", client)
          .maybeSingle(),
        supabase
          .from("sp_clients")
          .select("min_daily_send_volume,reserve_target_pct")
          .eq("slug", client)
          .maybeSingle(),
        supabase
          .from("vw_cockpit_burnt_domains")
          .select("domain_name")
          .eq("client", client),
        supabase
          .from("sp_decisions")
          .select("id")
          .eq("client", client)
          .eq("status", "proposed"),
        supabase
          .from("vw_cockpit_accounts")
          .select(
            "persona, warmup_health_pct, max_email_per_day, smartlead_tags, lifecycle_status, is_master_inbox"
          )
          .eq("client", client)
          .eq("is_master_inbox", false)
          .not("lifecycle_status", "in", "(retired,parked)"),
      ])
    if (!hs.data) return null

    // In-service = tagged {client}_active in Smartlead
    type PersonaAgg = {
      persona: string | null
      in_service_total: number
      in_service_healthy: number
      in_service_burnt: number
      in_service_daily_capacity: number
    }
    const personaMap = new Map<string, PersonaAgg>()
    let inServiceTotal = 0
    let inServiceHealthy = 0
    let inServiceBurnt = 0
    let inServiceCapacity = 0
    let atRiskInPlay = 0
    for (const acc of inServiceRows.data ?? []) {
      const health = acc.warmup_health_pct as number | null
      // At-risk regardless of Smartlead tag: below threshold on an in-play
      // lifecycle (rows here already exclude retired/parked/master).
      if (
        health !== null &&
        health < 97 &&
        acc.lifecycle_status !== "burnt"
      ) {
        atRiskInPlay++
      }
      const tags = (acc.smartlead_tags as string[] | null) ?? []
      const tagged = tags.some((t) =>
        String(t).toLowerCase().endsWith("_active")
      )
      if (!tagged) continue
      const boxCap = (acc.max_email_per_day as number | null) ?? 0
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
      entry.in_service_daily_capacity += boxCap
      if (isBurnt) entry.in_service_burnt++
      else entry.in_service_healthy++
      personaMap.set(key, entry)
      inServiceTotal++
      inServiceCapacity += boxCap
      if (isBurnt) inServiceBurnt++
      else inServiceHealthy++
    }
    const personaBreakdown = Array.from(personaMap.values()).sort(
      (a, b) => b.in_service_total - a.in_service_total
    )

    const active = hs.data.active ?? 0
    const reserve = hs.data.reserve ?? 0
    const targetDailyVolume = config.data?.min_daily_send_volume ?? null
    const bufferPct = config.data?.reserve_target_pct
      ? Number(config.data.reserve_target_pct)
      : 0.5

    const targetActiveMailboxes = targetDailyVolume
      ? Math.ceil(targetDailyVolume / DAILY_CAPACITY_PER_MAILBOX)
      : null
    const targetReserveMailboxes =
      targetActiveMailboxes !== null
        ? Math.ceil(targetActiveMailboxes * bufferPct)
        : null

    const activeDailyCapacity = cap.data?.active_daily_capacity ?? 0
    const effectiveCapacity = inServiceCapacity || activeDailyCapacity

    let capacityState: ClientCapacityRow["capacity_state"] = "unset"
    let capacityDeficitVolume = 0
    if (targetDailyVolume !== null) {
      capacityDeficitVolume = Math.max(targetDailyVolume - effectiveCapacity, 0)
      if (effectiveCapacity >= targetDailyVolume) capacityState = "ok"
      else if (effectiveCapacity >= targetDailyVolume * 0.8)
        capacityState = "warning"
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
      resting: hs.data.resting ?? 0,
      parked: hs.data.parked ?? 0,
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
      at_risk_in_play: atRiskInPlay,
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
      supabase
        .from("sp_clients")
        .select("master_email,master_domain")
        .eq("slug", client)
        .maybeSingle(),
      supabase
        .from("vw_cockpit_accounts")
        .select("email, warmup_health_pct, domain_name")
        .eq("client", client)
        .eq("is_master_inbox", true)
        .limit(1)
        .maybeSingle(),
    ])
    return {
      client,
      master_email: mc.data?.master_email ?? master.data?.email ?? null,
      master_domain: mc.data?.master_domain ?? master.data?.domain_name ?? null,
      health: master.data?.warmup_health_pct ?? null,
      exists: !!(master.data || mc.data?.master_email),
    }
  }
)

export const getClientPersonas = cache(
  async (client: string): Promise<string[]> => {
    const supabase = createServerClient()
    const { data } = await supabase
      .from("sp_clients")
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
      .from("sp_domain_candidates")
      .select("id", { count: "exact", head: true })
      .eq("client", client)
      .eq("status", "candidate")
    return count ?? 0
  }
)

export const getClientBurntDomains = cache(
  async (client: string): Promise<BurntDomainRow[]> => {
    const supabase = createServerClient()
    const { data } = await supabase
      .from("vw_cockpit_burnt_domains")
      .select("*")
      .eq("client", client)
      .order("latest_warmup_health", { ascending: true, nullsFirst: true })
    return (data ?? []) as BurntDomainRow[]
  }
)
