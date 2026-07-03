"use client"

import { useState, useEffect, useCallback } from "react"
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
import { healthColor } from "@/lib/design-tokens"
import { AlertTriangle, Radio, Loader2 } from "lucide-react"
import type { CampaignDetailPoint, CampaignMailbox, PlacementTestResult } from "@/lib/queries/campaigns"

interface CampaignDetailPanelProps {
  smartleadCampaignId: number
  latestSnapshot: {
    leads_not_started: number
    leads_in_progress: number
    leads_completed: number
    leads_blocked: number
  } | null
}

interface DetailData {
  history: CampaignDetailPoint[]
  mailboxes: CampaignMailbox[]
  placement: PlacementTestResult | null
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function HealthDot({ health }: { health: number | null }) {
  if (health === null) return <span className="inline-block h-2 w-2 rounded-full bg-stone-300 dark:bg-stone-600" />
  const colors = healthColor(health)
  return <span className={cn("inline-block h-2 w-2 rounded-full", colors.bg)} />
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    warming: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    reserve: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    ramping: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    burnt: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    draining: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    retired: "bg-stone-200 text-stone-500 dark:bg-stone-900 dark:text-stone-400",
    master: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        colorMap[status] ?? "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
      )}
    >
      {status.replace("_", " ")}
    </span>
  )
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

interface LiveStats {
  campaign_id: number
  total_leads: number
  emails_sent: number
  emails_opened: number
  replies: number
  positive_replies: number
  bounced: number
  unsubscribed: number
  open_rate: number | null
  reply_rate: number | null
  bounce_rate: number | null
  fetched_at: string
}

function LiveStatsCard({ campaignId }: { campaignId: number }) {
  const [stats, setStats] = useState<LiveStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)

  const fetchStats = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/smartlead/campaign-stats?campaign_id=${campaignId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed (${res.status})`)
        return res.json()
      })
      .then((json) => {
        setStats(json as LiveStats)
        setVisible(true)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [campaignId])

  if (!visible) {
    return (
      <button
        onClick={fetchStats}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Radio className="h-3 w-3" />
        )}
        Live Stats
      </button>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
        Failed to load live stats: {error}
        <button
          onClick={fetchStats}
          className="ml-2 underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!stats) return null

  const metrics = [
    { label: "Total Leads", value: stats.total_leads.toLocaleString() },
    { label: "Emails Sent", value: stats.emails_sent.toLocaleString() },
    { label: "Opened", value: stats.emails_opened.toLocaleString() },
    { label: "Replies", value: stats.replies.toLocaleString() },
    { label: "Interested", value: stats.positive_replies.toLocaleString() },
    { label: "Bounced", value: stats.bounced.toLocaleString() },
    {
      label: "Reply Rate",
      value: stats.reply_rate !== null ? `${stats.reply_rate.toFixed(1)}%` : "-",
    },
    {
      label: "Bounce Rate",
      value: stats.bounce_rate !== null ? `${stats.bounce_rate.toFixed(1)}%` : "-",
    },
  ]

  const fetchedTime = new Date(stats.fetched_at).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
            Live
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            Fetched {fetchedTime}
          </span>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="text-[10px] text-emerald-600 underline hover:no-underline disabled:opacity-50 dark:text-emerald-400"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {metrics.map((m) => (
          <div key={m.label} className="text-center">
            <div className="text-sm font-semibold tabular-nums">{m.value}</div>
            <div className="text-[10px] text-muted-foreground">{m.label}</div>
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

  const { history, mailboxes, placement } = data

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
            Reply Rate % (14d)
          </h4>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, "Reply Rate"]}
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

      {/* Live Stats */}
      <div>
        <h4 className="mb-2 text-xs font-medium text-muted-foreground">Smartlead Live Data</h4>
        <LiveStatsCard campaignId={smartleadCampaignId} />
      </div>

      {/* Mailboxes */}
      <div>
        <h4 className="mb-2 text-xs font-medium text-muted-foreground">
          Attached Mailboxes ({mailboxes.length})
        </h4>
        {mailboxes.length > 0 ? (
          <div className="max-h-[160px] space-y-1 overflow-y-auto">
            {mailboxes.map((mb) => (
              <div
                key={mb.id}
                className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted/50"
              >
                <HealthDot health={mb.warmup_health_pct} />
                <span className="font-mono">{mb.email}</span>
                <StatusBadge status={mb.lifecycle_status} />
                {mb.warmup_health_pct !== null && (
                  <span className="ml-auto tabular-nums text-muted-foreground">
                    {mb.warmup_health_pct}%
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No mailboxes attached</p>
        )}
      </div>
    </div>
  )
}
