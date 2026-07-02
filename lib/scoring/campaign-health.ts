// Campaign health scoring — pure function, no DB queries
// Weights: Reply Rate 35%, Bounce Rate 25%, Send Velocity 20%, Mailbox Health 20%

export type HealthStatus = "healthy" | "warning" | "critical"

export interface BreakdownItem {
  label: string
  score: number
  maxScore: number
}

export interface CampaignHealthResult {
  score: number
  status: HealthStatus
  breakdown: BreakdownItem[]
}

export interface CampaignHealthInput {
  replyRate: number // positive_reply_rate (percentage, e.g. 2.5)
  bounceRate: number // bounced / emails_sent (ratio, e.g. 0.03)
  emailsSent: number // recent emails_sent count
  avgMailboxHealth: number | null // average warmup_health_pct of attached mailboxes (0-100)
}

function scoreReplyRate(rate: number): number {
  if (rate >= 2) return 100
  if (rate >= 1) return 60
  if (rate >= 0.5) return 30
  return 0
}

function scoreBounceRate(rate: number): number {
  if (rate < 0.02) return 100
  if (rate < 0.05) return 60
  if (rate < 0.1) return 30
  return 0
}

function scoreSendVelocity(emailsSent: number): number {
  return emailsSent > 0 ? 100 : 0
}

function scoreMailboxHealth(health: number | null): number {
  if (health === null) return 50 // neutral when no data
  if (health >= 97) return 100
  if (health >= 90) return 60
  if (health >= 85) return 30
  return 0
}

function statusFromScore(score: number): HealthStatus {
  if (score >= 70) return "healthy"
  if (score >= 40) return "warning"
  return "critical"
}

export function computeCampaignHealthScore(input: CampaignHealthInput): CampaignHealthResult {
  const replyPts = scoreReplyRate(input.replyRate)
  const bouncePts = scoreBounceRate(input.bounceRate)
  const sendPts = scoreSendVelocity(input.emailsSent)
  const mailboxPts = scoreMailboxHealth(input.avgMailboxHealth)

  const score = Math.round(
    replyPts * 0.35 + bouncePts * 0.25 + sendPts * 0.2 + mailboxPts * 0.2
  )

  return {
    score,
    status: statusFromScore(score),
    breakdown: [
      { label: "Reply Rate", score: Math.round(replyPts * 0.35), maxScore: 35 },
      { label: "Bounce", score: Math.round(bouncePts * 0.25), maxScore: 25 },
      { label: "Send Velocity", score: Math.round(sendPts * 0.2), maxScore: 20 },
      { label: "Mailbox Health", score: Math.round(mailboxPts * 0.2), maxScore: 20 },
    ],
  }
}
