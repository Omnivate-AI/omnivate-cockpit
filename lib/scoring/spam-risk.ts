// Spam risk scoring — pure function, no DB queries
// Weights: Placement 50%, Reply Rate 30%, Bounce Rate 20%

export type SpamRiskStatus = "safe" | "warning" | "danger"

export interface SpamRiskResult {
  score: number
  status: SpamRiskStatus
}

export interface SpamRiskInput {
  latestPlacement: { spam_pct: number } | null
  replyRate: number // percentage, e.g. 2.5
  bounceRate: number // ratio, e.g. 0.03
  allTimeEmailsSent: number
}

function scorePlacement(spamPct: number | null): number {
  if (spamPct === null) return 0 // no data = no contribution
  if (spamPct > 30) return 100
  if (spamPct > 15) return 70
  if (spamPct > 5) return 40
  return 0
}

function scoreReplyRate(rate: number): number {
  if (rate < 0.3) return 100
  if (rate < 0.5) return 60
  if (rate < 1) return 30
  return 0
}

function scoreBounceRate(rate: number): number {
  if (rate > 0.1) return 100
  if (rate > 0.05) return 60
  return 0
}

function statusFromScore(score: number): SpamRiskStatus {
  if (score > 60) return "danger"
  if (score >= 30) return "warning"
  return "safe"
}

export function computeSpamRisk(input: SpamRiskInput): SpamRiskResult {
  const placementPts = scorePlacement(input.latestPlacement?.spam_pct ?? null)
  const replyPts = scoreReplyRate(input.replyRate)
  const bouncePts = scoreBounceRate(input.bounceRate)

  // Adjust weights when placement data is missing: redistribute 50% placement weight
  const hasPlacement = input.latestPlacement !== null
  const placementWeight = hasPlacement ? 0.5 : 0
  const replyWeight = hasPlacement ? 0.3 : 0.6
  const bounceWeight = hasPlacement ? 0.2 : 0.4

  const score = Math.round(
    placementPts * placementWeight +
      replyPts * replyWeight +
      bouncePts * bounceWeight
  )

  return {
    score,
    status: statusFromScore(score),
  }
}
