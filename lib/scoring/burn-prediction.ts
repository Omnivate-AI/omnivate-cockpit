// Rotation recommendation scoring — pure function, no DB queries
// Analyzes mailbox domain data to produce actionable recommendation cards

import { HEALTH_THRESHOLDS } from "@/lib/design-tokens"

export type RecommendationSeverity = "critical" | "warning"

export interface RotationRecommendation {
  severity: RecommendationSeverity
  type: "approaching_burn" | "declining_health" | "burnt_not_rotated" | "low_reserve"
  domainName: string | null
  metricValue: string
  action: string
}

export interface DomainInfo {
  id: number
  domain_name: string
  lifecycle_status: string
  latest_warmup_health: number | null
}

export interface DomainHealthDay {
  domain_id: number
  snapshot_date: string
  warmup_health_pct: number
}

export interface DomainAction {
  domain_id: number
  created_at: string
}

export interface ReserveStatus {
  activeCount: number
  reserveCount: number
  target: number
}

function detectApproachingBurn(domains: DomainInfo[]): RotationRecommendation[] {
  const results: RotationRecommendation[] = []
  for (const d of domains) {
    if (
      d.latest_warmup_health !== null &&
      d.latest_warmup_health >= 95 &&
      d.latest_warmup_health < HEALTH_THRESHOLDS.healthy &&
      d.lifecycle_status === "active"
    ) {
      results.push({
        severity: "warning",
        type: "approaching_burn",
        domainName: d.domain_name,
        metricValue: `${d.latest_warmup_health.toFixed(1)}% health`,
        action: "Consider reducing send volume or rotating to reserve domain",
      })
    }
  }
  return results
}

function detectDecliningHealth(
  domains: DomainInfo[],
  healthHistory: DomainHealthDay[]
): RotationRecommendation[] {
  const results: RotationRecommendation[] = []

  // Group history by domain_id
  const byDomain = new Map<number, DomainHealthDay[]>()
  for (const h of healthHistory) {
    if (!byDomain.has(h.domain_id)) byDomain.set(h.domain_id, [])
    byDomain.get(h.domain_id)!.push(h)
  }

  for (const d of domains) {
    if (d.lifecycle_status !== "active") continue
    const history = byDomain.get(d.id)
    if (!history || history.length < 4) continue

    // Sort by date desc and check last 5 entries for 3+ consecutive drops
    const sorted = [...history].sort(
      (a, b) => b.snapshot_date.localeCompare(a.snapshot_date)
    )
    const recent = sorted.slice(0, 5)

    let consecutiveDrops = 0
    for (let i = 0; i < recent.length - 1; i++) {
      if (recent[i].warmup_health_pct < recent[i + 1].warmup_health_pct) {
        consecutiveDrops++
      } else {
        break
      }
    }

    if (consecutiveDrops >= 3) {
      const drop = recent[recent.length - 1].warmup_health_pct - recent[0].warmup_health_pct
      results.push({
        severity: "critical",
        type: "declining_health",
        domainName: d.domain_name,
        metricValue: `${Math.abs(drop).toFixed(1)}% drop over ${consecutiveDrops} days`,
        action: "Health declining consistently. Rotate domain before it burns",
      })
    }
  }
  return results
}

function detectBurntNotRotated(
  domains: DomainInfo[],
  actionsLog: DomainAction[]
): RotationRecommendation[] {
  const results: RotationRecommendation[] = []
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  // Build set of domain IDs with recent actions
  const recentActionDomains = new Set<number>()
  for (const a of actionsLog) {
    if (new Date(a.created_at) >= sevenDaysAgo) {
      recentActionDomains.add(a.domain_id)
    }
  }

  for (const d of domains) {
    if (d.lifecycle_status === "burnt" && !recentActionDomains.has(d.id)) {
      results.push({
        severity: "critical",
        type: "burnt_not_rotated",
        domainName: d.domain_name,
        metricValue: "Burnt with no action in 7+ days",
        action: "Rotate this domain immediately. Replace with a reserve domain",
      })
    }
  }
  return results
}

function detectLowReserve(reserveStatus: ReserveStatus): RotationRecommendation[] {
  if (reserveStatus.target > 0 && reserveStatus.reserveCount < reserveStatus.target) {
    return [
      {
        severity: "warning",
        type: "low_reserve",
        domainName: null,
        metricValue: `${reserveStatus.reserveCount} / ${reserveStatus.target} reserve domains`,
        action: "Add more reserve domains to maintain rotation capacity",
      },
    ]
  }
  return []
}

export function getRotationRecommendations(
  domains: DomainInfo[],
  healthHistory: DomainHealthDay[],
  actionsLog: DomainAction[],
  reserveStatus: ReserveStatus
): RotationRecommendation[] {
  const all = [
    ...detectApproachingBurn(domains),
    ...detectDecliningHealth(domains, healthHistory),
    ...detectBurntNotRotated(domains, actionsLog),
    ...detectLowReserve(reserveStatus),
  ]

  // Sort by severity: critical first, then warning
  return all.sort((a, b) => {
    if (a.severity === b.severity) return 0
    return a.severity === "critical" ? -1 : 1
  })
}
