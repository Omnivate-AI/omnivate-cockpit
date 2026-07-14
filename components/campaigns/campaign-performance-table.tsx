"use client"

import React, { useState, useMemo } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { replyRateColor } from "@/lib/design-tokens"
import { ChevronDown } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { CampaignDetailPanel } from "@/components/campaigns/campaign-detail-panel"
import { CampaignComparisonDialog } from "@/components/campaigns/campaign-comparison-dialog"
import { CampaignActions } from "@/components/campaigns/campaign-actions"
import { MarkDoneToggle } from "@/components/campaigns/mark-done-toggle"
import { computeCampaignHealthScore } from "@/lib/scoring/campaign-health"
import { computeSpamRisk } from "@/lib/scoring/spam-risk"
import { SpamRiskBadge } from "@/components/campaigns/spam-risk-badge"
import { Button } from "@/components/ui/button"
import { BarChart3 } from "lucide-react"
import { useRouter } from "next/navigation"
import { DataAsOf } from "@/components/shared/data-as-of"
import type { ClientCampaign } from "@/lib/queries/campaigns"

// campaign_class from vw_cockpit_campaign_class (referral-aware, unlike
// the old primary/subsequence campaign_type)
type TypeFilter = "all" | "primary" | "follow_up" | "referral"
type TimeRange = "7" | "14" | "30" | "all"

const CLASS_CHIP: Record<
  string,
  { label: string; className: string }
> = {
  primary: {
    label: "Primary",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  follow_up: {
    label: "Follow-up",
    className:
      "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
  },
  referral: {
    label: "Referral",
    className:
      "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  },
}

/** Class with fallback for rows predating migration 009 */
function campaignClass(c: ClientCampaign): string {
  return (
    c.campaign_class ??
    (c.campaign_type === "subsequence" ? "follow_up" : "primary")
  )
}

interface SnapshotHistoryRow {
  campaign_id: number
  snapshot_date: string
  all_time_emails_sent: number
  all_time_interested: number
  reply_count: number
}

interface CampaignPerformanceTableProps {
  campaigns: ClientCampaign[]
  snapshotHistory?: SnapshotHistoryRow[]
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "..." : str
}

function healthBarColor(status: "healthy" | "warning" | "critical"): string {
  if (status === "healthy") return "bg-emerald-500"
  if (status === "warning") return "bg-amber-500"
  return "bg-rose-500"
}

// Active/past split follows the REAL Smartlead status now that the tab
// fetches all campaigns (was a sends-based heuristic over actives only).

function formatNum(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k"
  return n.toLocaleString()
}

function LeadStatusBar({ snap }: { snap: { leads_not_started: number; leads_in_progress: number; leads_completed: number; leads_blocked: number } | null }) {
  if (!snap) return null
  const total = snap.leads_not_started + snap.leads_in_progress + snap.leads_completed + snap.leads_blocked
  if (total === 0) return null

  const pct = (v: number) => (v / total) * 100
  const completePct = Math.round(pct(snap.leads_completed))

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="mt-1.5 w-full">
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
              {snap.leads_completed > 0 && (
                <div className="bg-emerald-500" style={{ width: `${pct(snap.leads_completed)}%` }} />
              )}
              {snap.leads_in_progress > 0 && (
                <div className="bg-blue-500" style={{ width: `${pct(snap.leads_in_progress)}%` }} />
              )}
              {snap.leads_blocked > 0 && (
                <div className="bg-rose-500" style={{ width: `${pct(snap.leads_blocked)}%` }} />
              )}
              {/* Not Started fills the rest via bg-muted on parent */}
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
              {completePct}% complete
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-stone-300 dark:bg-stone-600" />
              Not Started: {snap.leads_not_started.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
              In Progress: {snap.leads_in_progress.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Completed: {snap.leads_completed.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
              Blocked: {snap.leads_blocked.toLocaleString()}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface CampaignCardProps {
  campaign: ClientCampaign
  isExpanded: boolean
  onToggle: () => void
  onStatusChange?: () => void
}

function CampaignCard({ campaign, isExpanded, onToggle, onStatusChange }: CampaignCardProps) {
  const snap = campaign.latest
  const replyRate = snap?.positive_reply_rate ?? null
  const allTimeSent = snap?.all_time_emails_sent ?? 0
  const bounced = snap?.bounced ?? 0
  const bounceRate = allTimeSent > 0 ? bounced / allTimeSent : 0

  const healthResult = computeCampaignHealthScore({
    replyRate: replyRate ?? 0,
    bounceRate,
    emailsSent: allTimeSent,
    avgMailboxHealth: null,
  })

  const spamRisk = computeSpamRisk({
    latestPlacement: null,
    replyRate: replyRate ?? 0,
    bounceRate,
    allTimeEmailsSent: allTimeSent,
  })

  const rateColors = replyRate !== null ? replyRateColor(replyRate) : null

  return (
    <div className="overflow-hidden rounded-lg border bg-card transition-transform duration-200 hover:scale-[1.01]">
      <div
        className="flex cursor-pointer items-stretch hover:bg-muted/50 transition-colors duration-150"
        onClick={onToggle}
      >
        {/* Health color bar — 4px */}
        <div className={cn("w-1 shrink-0", healthBarColor(healthResult.status))} />

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-4 px-3 sm:px-4 py-3">
          {/* Name + class badge + lead status bar */}
          <div className="min-w-0 flex-[2]">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium" title={campaign.campaign_name}>
                {truncate(campaign.campaign_name, 50)}
              </span>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                  (CLASS_CHIP[campaignClass(campaign)] ?? CLASS_CHIP.primary)
                    .className
                )}
              >
                {(CLASS_CHIP[campaignClass(campaign)] ?? CLASS_CHIP.primary).label}
              </span>
              {campaign.considered_done && (
                <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  Done ✓
                </span>
              )}
              {!campaign.is_active && campaign.status && (
                <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                  {campaign.status.toLowerCase()}
                </span>
              )}
              <SpamRiskBadge risk={spamRisk} />
            </div>
            <LeadStatusBar snap={snap} />
          </div>

          {/* Hero reply rate */}
          <div className="hidden shrink-0 text-center sm:block">
            <div className={cn("text-xl font-bold tabular-nums", rateColors?.text)}>
              {replyRate !== null ? `${replyRate.toFixed(1)}%` : "\u2014"}
            </div>
            <div className="text-[10px] text-muted-foreground">Positive Reply Rate</div>
          </div>

          {/* Sent + Interested numbers (mini sparklines removed \u2014 V2 Phase 1) */}
          <div className="hidden gap-4 sm:flex">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Sent</div>
              <div className="text-sm font-semibold tabular-nums">
                {snap ? formatNum(snap.all_time_emails_sent) : "\u2014"}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Interested</div>
              <div className="text-sm font-semibold tabular-nums">
                {snap ? formatNum(snap.all_time_interested) : "\u2014"}
              </div>
            </div>
          </div>

          {/* Quick actions \u2014 Mark Done + View in Smartlead (dead Pause/Resume removed) */}
          <MarkDoneToggle
            campaignSpId={campaign.id}
            campaignName={campaign.campaign_name}
            consideredDone={campaign.considered_done ?? false}
            onChanged={onStatusChange}
          />
          <CampaignActions
            smartleadCampaignId={campaign.smartlead_campaign_id}
          />

          {/* Expand chevron */}
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              isExpanded && "rotate-180"
            )}
          />
        </div>
      </div>

      {isExpanded && (
        <CampaignDetailPanel
          smartleadCampaignId={campaign.smartlead_campaign_id}
          latestSnapshot={
            snap
              ? {
                  leads_not_started: snap.leads_not_started,
                  leads_in_progress: snap.leads_in_progress,
                  leads_completed: snap.leads_completed,
                  leads_blocked: snap.leads_blocked,
                }
              : null
          }
        />
      )}
    </div>
  )
}

/**
 * Compute period metrics from snapshot history.
 * For cumulative fields, delta = latest - earliest within the period.
 * For "all", use the latest snapshot values directly.
 */
function computePeriodMetrics(
  campaigns: ClientCampaign[],
  history: SnapshotHistoryRow[],
  range: TimeRange
): { interested: number; totalReplies: number; emailsSent: number } {
  if (range === "all") {
    // Sum latest snapshot values across all campaigns
    let interested = 0
    let totalReplies = 0
    let emailsSent = 0
    for (const c of campaigns) {
      if (c.latest) {
        interested += c.latest.all_time_interested
        totalReplies += c.latest.reply_count
        emailsSent += c.latest.all_time_emails_sent
      }
    }
    return { interested, totalReplies, emailsSent }
  }

  const days = parseInt(range)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split("T")[0]

  // Group history by campaign_id
  const byCampaign = new Map<number, SnapshotHistoryRow[]>()
  for (const row of history) {
    if (!byCampaign.has(row.campaign_id)) byCampaign.set(row.campaign_id, [])
    byCampaign.get(row.campaign_id)!.push(row)
  }

  let interested = 0
  let totalReplies = 0
  let emailsSent = 0

  for (const c of campaigns) {
    const rows = byCampaign.get(c.smartlead_campaign_id)
    if (!rows || rows.length === 0) continue

    // Find the earliest row at or after cutoff, and the latest row
    const inRange = rows.filter((r) => r.snapshot_date >= cutoffStr)
    if (inRange.length === 0) continue

    const earliest = inRange[0] // already sorted ascending from query
    const latest = inRange[inRange.length - 1]

    interested += Math.max(0, latest.all_time_interested - earliest.all_time_interested)
    totalReplies += Math.max(0, latest.reply_count - earliest.reply_count)
    emailsSent += Math.max(0, latest.all_time_emails_sent - earliest.all_time_emails_sent)
  }

  return { interested, totalReplies, emailsSent }
}

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "All Time" },
]

export function CampaignPerformanceTable({ campaigns, snapshotHistory = [] }: CampaignPerformanceTableProps) {
  const router = useRouter()
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [pausedCollapsed, setPausedCollapsed] = useState(true)
  const [timeRange, setTimeRange] = useState<TimeRange>("all")
  const [compareOpen, setCompareOpen] = useState(false)
  const handleStatusChange = () => router.refresh()

  const periodMetrics = useMemo(
    () => computePeriodMetrics(campaigns, snapshotHistory, timeRange),
    [campaigns, snapshotHistory, timeRange]
  )

  const filtered = useMemo(() => {
    if (typeFilter === "all") return campaigns
    return campaigns.filter((c) => campaignClass(c) === typeFilter)
  }, [campaigns, typeFilter])

  // Split by REAL Smartlead status (active vs past), sorted
  // worst-health-first, primary before follow-up/referral
  const { active, paused } = useMemo(() => {
    const classRank = (c: ClientCampaign) =>
      campaignClass(c) === "primary" ? 0 : 1
    const sortFn = (a: ClientCampaign, b: ClientCampaign) => {
      // Primary before follow-up/referral
      if (classRank(a) !== classRank(b)) {
        return classRank(a) - classRank(b)
      }
      // Worst health first
      const aSnap = a.latest
      const bSnap = b.latest
      const aRate = aSnap?.positive_reply_rate ?? 0
      const bRate = bSnap?.positive_reply_rate ?? 0
      const aSent = aSnap?.all_time_emails_sent ?? 0
      const bSent = bSnap?.all_time_emails_sent ?? 0
      const aBounce = aSent > 0 ? (aSnap?.bounced ?? 0) / aSent : 0
      const bBounce = bSent > 0 ? (bSnap?.bounced ?? 0) / bSent : 0
      const aHealth = computeCampaignHealthScore({ replyRate: aRate, bounceRate: aBounce, emailsSent: aSent, avgMailboxHealth: null }).score
      const bHealth = computeCampaignHealthScore({ replyRate: bRate, bounceRate: bBounce, emailsSent: bSent, avgMailboxHealth: null }).score
      return aHealth - bHealth // worst first
    }

    const activeCampaigns = filtered.filter((c) => c.is_active).sort(sortFn)
    const pausedCampaigns = filtered.filter((c) => !c.is_active).sort(sortFn)

    return { active: activeCampaigns, paused: pausedCampaigns }
  }, [filtered])

  const periodLabel = TIME_RANGE_OPTIONS.find((o) => o.value === timeRange)?.label ?? "All Time"

  const latestCampaignDate = useMemo(() => {
    let latest: string | null = null
    for (const c of campaigns) {
      const d = c.latest?.snapshot_date
      if (d && (!latest || d > latest)) latest = d
    }
    return latest
  }, [campaigns])

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Type:</span>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="primary">Primary</SelectItem>
            <SelectItem value="follow_up">Follow-up</SelectItem>
            <SelectItem value="referral">Referral</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground">Period:</span>
        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-3">
          <DataAsOf factDate={latestCampaignDate} />
          <span className="text-xs text-muted-foreground">
            {filtered.length} campaign{filtered.length !== 1 ? "s" : ""}
          </span>
          {campaigns.length >= 2 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setCompareOpen(true)}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Compare
            </Button>
          )}
        </div>
      </div>

      {/* Hero metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Interested Leads</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatNum(periodMetrics.interested)}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{periodLabel}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Total Replies</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">
            {formatNum(periodMetrics.totalReplies)}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{periodLabel}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Emails Sent</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">
            {formatNum(periodMetrics.emailsSent)}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{periodLabel}</div>
        </div>
      </div>

      {/* Active Campaigns */}
      {active.length > 0 && (
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Active Campaigns
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-normal text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              {active.length}
            </span>
          </h3>
          <div className="space-y-2">
            {active.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                isExpanded={expandedId === campaign.smartlead_campaign_id}
                onToggle={() =>
                  setExpandedId(
                    expandedId === campaign.smartlead_campaign_id
                      ? null
                      : campaign.smartlead_campaign_id
                  )
                }
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        </div>
      )}

      {/* Paused & Completed */}
      {paused.length > 0 && (
        <div className="space-y-2">
          <button
            className="flex w-full items-center gap-2 text-sm font-medium"
            onClick={() => setPausedCollapsed((v) => !v)}
          >
            <span className="inline-block h-2 w-2 rounded-full bg-stone-400" />
            Past Campaigns
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-normal text-stone-600 dark:bg-stone-800 dark:text-stone-300">
              {paused.length}
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              paused · completed · drafted · archived
            </span>
            <ChevronDown
              className={cn(
                "ml-auto h-4 w-4 text-muted-foreground transition-transform",
                pausedCollapsed && "-rotate-90"
              )}
            />
          </button>
          <div
            className="collapsible-content"
            data-state={pausedCollapsed ? "closed" : "open"}
          >
            <div className="space-y-2">
              {paused.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  isExpanded={expandedId === campaign.smartlead_campaign_id}
                  onToggle={() =>
                    setExpandedId(
                      expandedId === campaign.smartlead_campaign_id
                        ? null
                        : campaign.smartlead_campaign_id
                    )
                  }
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex h-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center">
          <p className="text-sm font-medium">No campaigns match these filters</p>
          <p className="text-xs text-muted-foreground">
            Try a different type or period.
          </p>
        </div>
      )}

      {/* Comparison dialog */}
      <CampaignComparisonDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        campaigns={campaigns}
      />
    </div>
  )
}
