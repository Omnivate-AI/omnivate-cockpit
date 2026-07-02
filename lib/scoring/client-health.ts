// Client health scoring — pure function, no DB queries
// Weights: Mailbox Health 20%, Send Adherence 20%, Reply Rate 20%, Inbox Placement 20%, Alert Penalty 20%

export type ClientHealthStatus = "healthy" | "warning" | "critical"

export interface ClientHealthBreakdown {
  label: string
  score: number
  maxScore: number
}

export interface ClientHealthResult {
  score: number
  status: ClientHealthStatus
  breakdown: ClientHealthBreakdown[]
}

export interface ClientHealthInput {
  avgMailboxHealth: number | null // 0-100, null if no data
  sendAdherence: number | null // sent / target ratio (e.g. 0.95 = 95%), null if no target
  replyRate: number | null // percentage (e.g. 2.5), null if no sends
  inboxPlacement: number | null // inbox_pct 0-100, null if no tests
  pendingAlerts: number // count of pending alerts
}

function scoreMailboxHealth(health: number | null): number {
  if (health === null) return 50 // neutral when no data
  if (health >= 97) return 100
  if (health >= 90) return 60
  if (health >= 85) return 30
  return 0
}

function scoreSendAdherence(ratio: number | null): number {
  if (ratio === null) return 50 // neutral when no target
  if (ratio >= 0.9) return 100
  if (ratio >= 0.7) return 60
  if (ratio >= 0.5) return 30
  return 0
}

function scoreReplyRate(rate: number | null): number {
  if (rate === null) return 50 // neutral when no sends
  if (rate >= 2) return 100
  if (rate >= 1) return 60
  if (rate >= 0.5) return 30
  return 0
}

function scoreInboxPlacement(pct: number | null): number {
  if (pct === null) return 50 // neutral when no tests
  if (pct >= 90) return 100
  if (pct >= 70) return 60
  if (pct >= 50) return 30
  return 0
}

function scoreAlertPenalty(count: number): number {
  if (count === 0) return 100
  if (count <= 2) return 60
  if (count <= 5) return 30
  return 0
}

function statusFromScore(score: number): ClientHealthStatus {
  if (score >= 80) return "healthy"
  if (score >= 50) return "warning"
  return "critical"
}

export function computeClientHealthScore(
  input: ClientHealthInput
): ClientHealthResult {
  const mailboxPts = scoreMailboxHealth(input.avgMailboxHealth)
  const sendPts = scoreSendAdherence(input.sendAdherence)
  const replyPts = scoreReplyRate(input.replyRate)
  const placementPts = scoreInboxPlacement(input.inboxPlacement)
  const alertPts = scoreAlertPenalty(input.pendingAlerts)

  const score = Math.round(
    mailboxPts * 0.2 +
      sendPts * 0.2 +
      replyPts * 0.2 +
      placementPts * 0.2 +
      alertPts * 0.2
  )

  return {
    score,
    status: statusFromScore(score),
    breakdown: [
      { label: "Mailbox Health", score: Math.round(mailboxPts * 0.2), maxScore: 20 },
      { label: "Send Adherence", score: Math.round(sendPts * 0.2), maxScore: 20 },
      { label: "Reply Rate", score: Math.round(replyPts * 0.2), maxScore: 20 },
      { label: "Inbox Placement", score: Math.round(placementPts * 0.2), maxScore: 20 },
      { label: "Alert Penalty", score: Math.round(alertPts * 0.2), maxScore: 20 },
    ],
  }
}
