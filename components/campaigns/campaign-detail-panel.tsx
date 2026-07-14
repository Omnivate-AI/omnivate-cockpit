"use client"

import { useState, useEffect } from "react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { AlertTriangle } from "lucide-react"
import type { CampaignDetailPoint, PlacementTestResult } from "@/lib/queries/campaigns"

interface CampaignDetailPanelProps {
  smartleadCampaignId: number
  latestSnapshot: {
    leads_not_started: number
    leads_in_progress: number
    leads_completed: number
    leads_blocked: number
  } | null
}

// The detail API also returns `mailboxes`; the panel stopped rendering it in
// V2 Phase 1 (the Mailboxes tab owns that story), so only the used fields
// are declared here.
interface DetailData {
  history: CampaignDetailPoint[]
  placement: PlacementTestResult | null
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function LeadFunnelBar({ snapshot }: { snapshot: CampaignDetailPanelProps["latestSnapshot"] }) {
  if (!snapshot) return <p className="text-xs text-muted-foreground">No lead data</p>

  const { leads_not_started, leads_in_progress, leads_completed, leads_blocked } = snapshot
  const total = leads_not_started + leads_in_progress + leads_completed + leads_blocked
  if (total === 0) return <p className="text-xs text-muted-foreground">No lead data</p>

  const segments = [
    { label: "Not Started", count: leads_not_started, color: "bg-stone-400" },
    { label: "In Progress", count: leads_in_progress, color: "bg-blue-500" },
    { label: "Completed", count: leads_completed, color: "bg-emerald-500" },
    { label: "Blocked", count: leads_blocked, color: "bg-rose-500" },
  ]

  return (
    <div className="space-y-2">
      <div className="flex h-5 w-full overflow-hidden rounded-full">
        {segments.map(
          (seg) =>
            seg.count > 0 && (
              <div
                key={seg.label}
                className={cn(seg.color, "h-full")}
                style={{ width: `${(seg.count / total) * 100}%` }}
                title={`${seg.label}: ${seg.count.toLocaleString()}`}
              />
            )
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("inline-block h-2 w-2 rounded-full", seg.color)} />
            {seg.label}: {seg.count.toLocaleString()}
          </div>
        ))}
      </div>
    </div>
  )
}

function InboxPlacement({ placement }: { placement: PlacementTestResult | null }) {
  if (!placement) {
    return <p className="text-xs text-muted-foreground">No placement data</p>
  }

  const { inbox_pct, spam_pct, missing_pct, test_date } = placement
  const testDateFormatted = new Date(test_date + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  const segments = [
    { label: "Inbox", pct: inbox_pct ?? 0, color: "bg-emerald-500" },
    { label: "Spam", pct: spam_pct ?? 0, color: "bg-rose-500" },
    { label: "Missing", pct: missing_pct ?? 0, color: "bg-stone-300" },
  ]

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {(spam_pct ?? 0) > 10 && (
          <AlertTriangle className="h-4 w-4 text-rose-500" />
        )}
        <span className="text-xs text-muted-foreground">Last tested: {testDateFormatted}</span>
      </div>
      <div className="flex h-5 w-full overflow-hidden rounded-full">
        {segments.map(
          (seg) =>
            seg.pct > 0 && (
              <div
                key={seg.label}
                className={cn(seg.color, "h-full")}
                style={{ width: `${seg.pct}%` }}
                title={`${seg.label}: ${seg.pct.toFixed(1)}%`}
              />
            )
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("inline-block h-2 w-2 rounded-full", seg.color)} />
            {seg.label}: {seg.pct.toFixed(1)}%
          </div>
        ))}
      </div>
    </div>
  )
}

export function CampaignDetailPanel({
  smartleadCampaignId,
  latestSnapshot,
}: CampaignDetailPanelProps) {
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/campaigns/${smartleadCampaignId}/detail`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load (${res.status})`)
        return res.json()
      })
      .then((json) => {
        if (!cancelled) setData(json as DetailData)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [smartleadCampaignId])

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-[100px] w-full" />
          <Skeleton className="h-[100px] w-full" />
        </div>
        <Skeleton className="h-[40px] w-full" />
        <Skeleton className="h-[60px] w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-rose-600">
        Failed to load campaign details: {error}
      </div>
    )
  }

  if (!data) return null

  const { history, placement } = data

  // Compute daily sends as day-over-day deltas of all_time_emails_sent
  const chartData = history.map((d, i) => {
    const prevAllTime = i > 0 ? history[i - 1].all_time_emails_sent : d.all_time_emails_sent
    const dailySent = Math.max(0, d.all_time_emails_sent - prevAllTime)
    return {
      date: formatDate(d.snapshot_date),
      sent: dailySent,
      replyRate: d.positive_reply_rate,
    }
  })

  return (
    <div className="space-y-5 border-t bg-muted/30 p-4">
      {/* Sparklines */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* 14-day send sparkline */}
        <div>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">
            Daily Sends (14d)
          </h4>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(value: number) => [value.toLocaleString(), "Sent"]}
                />
                <Bar dataKey="sent" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground">No send data</p>
          )}
        </div>

        {/* 14-day reply rate sparkline */}
        <div>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">
            Positive Reply Rate % (14d)
          </h4>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, "Positive reply rate"]}
                />
                <Line
                  dataKey="replyRate"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground">No reply data</p>
          )}
        </div>
      </div>

      {/* Lead funnel */}
      <div>
        <h4 className="mb-2 text-xs font-medium text-muted-foreground">Lead Status</h4>
        <LeadFunnelBar snapshot={latestSnapshot} />
      </div>

      {/* Inbox Placement */}
      <div>
        <h4 className="mb-2 text-xs font-medium text-muted-foreground">Inbox Placement</h4>
        <InboxPlacement placement={placement} />
      </div>

      {/* Attached Mailboxes + Smartlead Live Data sections removed
          (V2 Phase 1) — the Mailboxes tab owns both stories. */}
    </div>
  )
}
