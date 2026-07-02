"use client"

import React from "react"
import { AlertTriangle, ShieldAlert, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ClientCampaign, PlacementTestResult } from "@/lib/queries/campaigns"

// --- Types ---

type IssueSeverity = "critical" | "warning"
type IssueType = "high_spam" | "low_reply_rate" | "reply_rate_drop"

interface DeliverabilityIssue {
  campaignName: string
  smartleadCampaignId: number
  type: IssueType
  severity: IssueSeverity
  description: string
  suggestedAction: string
}

interface DeliverabilityIssuesProps {
  campaigns: ClientCampaign[]
  placements: PlacementTestResult[]
  snapshotHistory?: { campaign_id: number; snapshot_date: string; all_time_emails_sent: number; all_time_interested: number; reply_count: number }[]
}

// --- Detection Logic ---

function detectIssues(
  campaigns: ClientCampaign[],
  placements: PlacementTestResult[],
  snapshotHistory: DeliverabilityIssuesProps["snapshotHistory"]
): DeliverabilityIssue[] {
  const issues: DeliverabilityIssue[] = []

  // Index latest placement per campaign
  const placementByCampaign = new Map<number, PlacementTestResult>()
  for (const p of placements) {
    if (!placementByCampaign.has(p.smartlead_campaign_id)) {
      placementByCampaign.set(p.smartlead_campaign_id, p)
    }
  }

  // Index snapshot history by campaign for reply rate drop detection
  const historyByCampaign = new Map<number, { snapshot_date: string; all_time_interested: number; all_time_emails_sent: number }[]>()
  if (snapshotHistory) {
    for (const row of snapshotHistory) {
      if (!historyByCampaign.has(row.campaign_id)) historyByCampaign.set(row.campaign_id, [])
      historyByCampaign.get(row.campaign_id)!.push(row)
    }
  }

  for (const campaign of campaigns) {
    const snap = campaign.latest
    if (!snap) continue

    const allTimeSent = snap.all_time_emails_sent
    const replyRate = snap.positive_reply_rate

    // 1. High spam detection
    const placement = placementByCampaign.get(campaign.smartlead_campaign_id)
    if (placement && (placement.spam_pct ?? 0) > 10) {
      issues.push({
        campaignName: campaign.campaign_name,
        smartleadCampaignId: campaign.smartlead_campaign_id,
        type: "high_spam",
        severity: (placement.spam_pct ?? 0) > 20 ? "critical" : "warning",
        description: `${(placement.spam_pct ?? 0).toFixed(0)}% of emails landing in spam (tested ${placement.test_date})`,
        suggestedAction: (placement.spam_pct ?? 0) > 20
          ? "Pause campaign immediately. Check domain reputation and email content."
          : "Review email content and sender reputation. Consider rotating mailboxes.",
      })
    }

    // 2. Low reply rate (< 0.3% with > 500 sent)
    if (allTimeSent > 500 && replyRate < 0.3) {
      issues.push({
        campaignName: campaign.campaign_name,
        smartleadCampaignId: campaign.smartlead_campaign_id,
        type: "low_reply_rate",
        severity: replyRate < 0.1 ? "critical" : "warning",
        description: `Reply rate ${replyRate.toFixed(2)}% across ${allTimeSent.toLocaleString()} emails sent`,
        suggestedAction: "Review email copy, subject lines, and targeting. Consider A/B testing.",
      })
    }

    // 3. Reply rate drop > 50% (compare last 7 days vs prior 7 days)
    const history = historyByCampaign.get(campaign.smartlead_campaign_id)
    if (history && history.length >= 14) {
      // History is sorted ascending by date
      const sorted = [...history].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
      const recent = sorted.slice(-7)
      const prior = sorted.slice(-14, -7)

      const recentSentDelta = (recent[recent.length - 1]?.all_time_emails_sent ?? 0) - (recent[0]?.all_time_emails_sent ?? 0)
      const recentInterestedDelta = (recent[recent.length - 1]?.all_time_interested ?? 0) - (recent[0]?.all_time_interested ?? 0)
      const priorSentDelta = (prior[prior.length - 1]?.all_time_emails_sent ?? 0) - (prior[0]?.all_time_emails_sent ?? 0)
      const priorInterestedDelta = (prior[prior.length - 1]?.all_time_interested ?? 0) - (prior[0]?.all_time_interested ?? 0)

      if (priorSentDelta > 0 && recentSentDelta > 0 && priorInterestedDelta > 0) {
        const priorRate = priorInterestedDelta / priorSentDelta
        const recentRate = recentInterestedDelta / recentSentDelta

        if (recentRate < priorRate * 0.5) {
          issues.push({
            campaignName: campaign.campaign_name,
            smartleadCampaignId: campaign.smartlead_campaign_id,
            type: "reply_rate_drop",
            severity: "critical",
            description: `Reply rate dropped ${((1 - recentRate / priorRate) * 100).toFixed(0)}% in the last 7 days`,
            suggestedAction: "Check if domain was blacklisted. Review recent email content changes.",
          })
        }
      }
    }
  }

  // Sort: critical first, then by type
  issues.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1
    return 0
  })

  return issues
}

// --- Components ---

const ISSUE_TYPE_CONFIG: Record<IssueType, { label: string; icon: React.ElementType }> = {
  high_spam: { label: "High Spam", icon: ShieldAlert },
  low_reply_rate: { label: "Low Reply Rate", icon: TrendingDown },
  reply_rate_drop: { label: "Reply Rate Drop", icon: TrendingDown },
}

function IssueCard({ issue }: { issue: DeliverabilityIssue }) {
  const config = ISSUE_TYPE_CONFIG[issue.type]
  const Icon = config.icon
  const isCritical = issue.severity === "critical"

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3",
        isCritical
          ? "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30"
          : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          isCritical ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{issue.campaignName}</span>
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
              isCritical
                ? "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
            )}
          >
            {config.label}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{issue.description}</p>
        <p
          className={cn(
            "mt-1 text-xs font-medium",
            isCritical ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300"
          )}
        >
          {issue.suggestedAction}
        </p>
      </div>
    </div>
  )
}

export function DeliverabilityIssues({ campaigns, placements, snapshotHistory }: DeliverabilityIssuesProps) {
  const issues = detectIssues(campaigns, placements, snapshotHistory)

  if (issues.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        Deliverability Issues
        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-normal text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          {issues.length}
        </span>
      </h3>
      <div className="space-y-2">
        {issues.map((issue, idx) => (
          <IssueCard key={`${issue.smartleadCampaignId}-${issue.type}-${idx}`} issue={issue} />
        ))}
      </div>
    </div>
  )
}
