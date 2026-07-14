"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { cn } from "@/lib/utils"
import { Trophy } from "lucide-react"
import type { ClientCampaign, CampaignDetailPoint } from "@/lib/queries/campaigns"

const COMPARISON_COLORS = [
  "#2563eb", // blue
  "#d946ef", // fuchsia
  "#f97316", // orange
]

interface CampaignComparisonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaigns: ClientCampaign[]
}

interface ComparisonData {
  campaignId: number
  campaignName: string
  history: CampaignDetailPoint[]
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "..." : str
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function CampaignComparisonDialog({
  open,
  onOpenChange,
  campaigns,
}: CampaignComparisonDialogProps) {
  const [selected, setSelected] = useState<number[]>([])
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([])
  const [loading, setLoading] = useState(false)
  const [showComparison, setShowComparison] = useState(false)

  // Reset when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelected([])
      setComparisonData([])
      setShowComparison(false)
    }
  }, [open])

  function toggleCampaign(campaignId: number) {
    setSelected((prev) => {
      if (prev.includes(campaignId)) {
        return prev.filter((id) => id !== campaignId)
      }
      if (prev.length >= 3) return prev
      return [...prev, campaignId]
    })
  }

  async function loadComparison() {
    setLoading(true)
    try {
      const results: ComparisonData[] = []
      for (const campaignId of selected) {
        const campaign = campaigns.find((c) => c.smartlead_campaign_id === campaignId)
        if (!campaign) continue
        const resp = await fetch(`/api/campaigns/${campaignId}/detail`)
        if (!resp.ok) continue
        const data = await resp.json()
        results.push({
          campaignId,
          campaignName: campaign.campaign_name,
          history: data.history ?? [],
        })
      }
      setComparisonData(results)
      setShowComparison(true)
    } finally {
      setLoading(false)
    }
  }

  // Build merged chart data for each metric
  const { sendsData, replyRateData, placementData, bestPerformers } = useMemo(() => {
    if (comparisonData.length === 0)
      return { sendsData: [], replyRateData: [], placementData: [], bestPerformers: { sends: null, replyRate: null, placement: null } }

    // Collect all dates
    const dateSet = new Set<string>()
    for (const cd of comparisonData) {
      for (const pt of cd.history) dateSet.add(pt.snapshot_date)
    }
    const dates = Array.from(dateSet).sort()

    // Build indexed history per campaign
    const indexed = comparisonData.map((cd) => {
      const byDate = new Map<string, CampaignDetailPoint>()
      for (const pt of cd.history) byDate.set(pt.snapshot_date, pt)
      return { ...cd, byDate }
    })

    // Sends: daily delta of all_time_emails_sent
    const sendsData = dates.map((date, i) => {
      const row: Record<string, string | number> = { date: formatDate(date) }
      for (let ci = 0; ci < indexed.length; ci++) {
        const curr = indexed[ci].byDate.get(date)
        const prevDate = i > 0 ? dates[i - 1] : null
        const prev = prevDate ? indexed[ci].byDate.get(prevDate) : null
        const delta =
          curr && prev
            ? Math.max(0, curr.all_time_emails_sent - prev.all_time_emails_sent)
            : 0
        row[`c${ci}`] = delta
      }
      return row
    })

    // Reply rate
    const replyRateData = dates.map((date) => {
      const row: Record<string, string | number> = { date: formatDate(date) }
      for (let ci = 0; ci < indexed.length; ci++) {
        const pt = indexed[ci].byDate.get(date)
        row[`c${ci}`] = pt?.positive_reply_rate ?? 0
      }
      return row
    })

    // Inbox placement — not available in history (only latest), skip if no data
    // We'll show latest values as a summary instead
    const placementData: Record<string, string | number>[] = []

    // Determine best performers
    const totalSends = indexed.map((cd) => {
      const latest = cd.history[cd.history.length - 1]
      return latest?.all_time_emails_sent ?? 0
    })
    const avgReplyRates = indexed.map((cd) => {
      if (cd.history.length === 0) return 0
      const latest = cd.history[cd.history.length - 1]
      return latest?.positive_reply_rate ?? 0
    })

    const bestSendIdx = totalSends.indexOf(Math.max(...totalSends))
    const bestReplyIdx = avgReplyRates.indexOf(Math.max(...avgReplyRates))

    return {
      sendsData,
      replyRateData,
      placementData,
      bestPerformers: {
        sends: totalSends[bestSendIdx] > 0 ? indexed[bestSendIdx]?.campaignName ?? null : null,
        replyRate: avgReplyRates[bestReplyIdx] > 0 ? indexed[bestReplyIdx]?.campaignName ?? null : null,
        placement: null,
      },
    }
  }, [comparisonData])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compare Campaigns</DialogTitle>
        </DialogHeader>

        {!showComparison ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select 2–3 campaigns to compare side by side.
            </p>

            <div className="max-h-64 space-y-1 overflow-y-auto rounded border p-2">
              {campaigns.map((c) => {
                const checked = selected.includes(c.smartlead_campaign_id)
                const disabled = !checked && selected.length >= 3
                return (
                  <label
                    key={c.smartlead_campaign_id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 hover:bg-muted/50",
                      disabled && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={() => toggleCampaign(c.smartlead_campaign_id)}
                    />
                    <span className="min-w-0 truncate text-sm">
                      {c.campaign_name}
                    </span>
                    <span
                      className={cn(
                        "ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px]",
                        c.campaign_type === "primary"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
                      )}
                    >
                      {c.campaign_type === "primary" ? "Primary" : "Sub-seq"}
                    </span>
                  </label>
                )
              })}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {selected.length}/3 selected
              </span>
              <Button
                onClick={loadComparison}
                disabled={selected.length < 2 || loading}
              >
                {loading ? "Loading..." : "Compare"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Legend */}
            <div className="flex flex-wrap gap-3">
              {comparisonData.map((cd, i) => (
                <div key={cd.campaignId} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: COMPARISON_COLORS[i] }}
                  />
                  <span className="text-xs">{truncate(cd.campaignName, 30)}</span>
                </div>
              ))}
            </div>

            {/* Daily Sends */}
            <ComparisonChart
              title="Daily Sends"
              data={sendsData}
              count={comparisonData.length}
              bestPerformer={bestPerformers.sends}
              yFormatter={(v) => (typeof v === "number" && v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
            />

            {/* Reply Rate */}
            <ComparisonChart
              title="Positive Reply Rate (%)"
              data={replyRateData}
              count={comparisonData.length}
              bestPerformer={bestPerformers.replyRate}
              yFormatter={(v) => `${Number(v).toFixed(1)}%`}
            />

            {/* Inbox Placement summary */}
            <div className="rounded-lg border p-4">
              <h4 className="mb-2 text-sm font-medium">Inbox Placement</h4>
              <p className="text-xs text-muted-foreground">
                Placement data is point-in-time. View individual campaign details for inbox placement results.
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowComparison(false)
                  setComparisonData([])
                  setSelected([])
                }}
              >
                Close comparison
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ComparisonChart({
  title,
  data,
  count,
  bestPerformer,
  yFormatter,
}: {
  title: string
  data: Record<string, string | number>[]
  count: number
  bestPerformer: string | null
  yFormatter?: (value: number | string) => string
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border p-4">
        <h4 className="mb-1 text-sm font-medium">{title}</h4>
        <p className="text-xs text-muted-foreground">No data available</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-medium">{title}</h4>
        {bestPerformer && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Trophy className="h-3 w-3" />
            {truncate(bestPerformer, 25)}
          </span>
        )}
      </div>
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10 }}
              width={45}
              tickFormatter={yFormatter}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                const idx = parseInt(name.replace("c", ""))
                const formatted = yFormatter ? yFormatter(value) : String(value)
                return [formatted, `Campaign ${idx + 1}`]
              }}
            />
            {Array.from({ length: count }, (_, i) => (
              <Line
                key={`c${i}`}
                type="monotone"
                dataKey={`c${i}`}
                stroke={COMPARISON_COLORS[i]}
                strokeWidth={2}
                dot={false}
                animationDuration={800}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
