"use client"

import React, { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import type {
  SnapshotsResponse,
  ClientSnapshot,
  DailyPoint,
  CampaignSnapshot,
  ClientConfig,
} from "@/types/analytics"
import { RunwayMeter } from "./RunwayMeter"
import { SendsChart } from "./SendsChart"
import { RepliesChart } from "./RepliesChart"
import { CampaignTable } from "./CampaignTable"
import { SettingsPanel } from "./SettingsPanel"
import { PipelineFunnel } from "./PipelineFunnel"
import { PerformanceCard } from "./PerformanceCard"
import { CombinedChart } from "./CombinedChart"
import { PerformanceTrendChart } from "./PerformanceTrendChart"

function SkeletonPulse({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className ?? ""}`} style={style} />
}

function SkeletonStatBlock() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white px-5 py-4">
      <SkeletonPulse className="h-7 w-16" />
      <SkeletonPulse className="h-3 w-24" />
      <SkeletonPulse className="h-3 w-20" />
    </div>
  )
}

const SKELETON_BAR_HEIGHTS = [45, 62, 38, 75, 55, 80, 42, 68, 50, 72, 35, 65, 58, 48]

function SkeletonChart() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex h-[180px] items-end gap-1">
        {SKELETON_BAR_HEIGHTS.map((h, i) => (
          <SkeletonPulse
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  )
}

function SkeletonTableRow() {
  return (
    <div className="flex items-center gap-4 border-b border-gray-100 px-4 py-3">
      <SkeletonPulse className="h-4 w-40" />
      <SkeletonPulse className="h-4 w-16 ml-auto" />
      <SkeletonPulse className="h-4 w-16" />
      <SkeletonPulse className="h-4 w-16" />
      <SkeletonPulse className="h-4 w-12" />
    </div>
  )
}

interface ClientDetailProps {
  clientSlug: string
}

function StatusBadge({ status }: { status: "critical" | "warning" | "healthy" }) {
  const styles = {
    critical: "bg-red-50 text-red-600 ring-red-200",
    warning: "bg-amber-50 text-amber-600 ring-amber-200",
    healthy: "bg-emerald-50 text-emerald-600 ring-emerald-200",
  }
  const labels = { critical: "Critical", warning: "Warning", healthy: "Healthy" }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ring-1 ring-inset ${styles[status]}`}
    >
      {labels[status]}
    </span>
  )
}

function StatBlock({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white px-5 py-4">
      <span className="text-2xl font-semibold tracking-tight text-gray-900">{value}</span>
      <span className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`
  return n.toLocaleString()
}

/** Compare last-7-days average vs prior-7-days average for a given numeric field. */
function computeTrend(
  hist: DailyPoint[],
  field: keyof Pick<DailyPoint, "emails_sent_count" | "positive_replies_count" | "reply_count" | "bounced">,
): { pct: number; direction: "up" | "down" | "flat" } | null {
  if (hist.length < 14) return null
  const recent = hist.slice(-7)
  const prior = hist.slice(-14, -7)
  const avg = (arr: DailyPoint[]) =>
    arr.reduce((s, d) => s + (d[field] as number), 0) / arr.length
  const recentAvg = avg(recent)
  const priorAvg = avg(prior)
  if (priorAvg === 0 && recentAvg === 0) return { pct: 0, direction: "flat" }
  if (priorAvg === 0) return { pct: 100, direction: "up" }
  const pct = ((recentAvg - priorAvg) / priorAvg) * 100
  const direction = pct > 5 ? "up" : pct < -5 ? "down" : "flat"
  return { pct: Math.abs(Math.round(pct)), direction }
}

function TrendBadge({ trend }: { trend: { pct: number; direction: "up" | "down" | "flat" } }) {
  const styles = {
    up: "text-emerald-600",
    down: "text-red-600",
    flat: "text-gray-500",
  }
  const arrows = { up: "▲", down: "▼", flat: "→" }
  return (
    <span
      data-testid="trend-badge"
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${styles[trend.direction]}`}
    >
      {arrows[trend.direction]} {trend.direction === "flat" ? "flat" : `${trend.pct}%`}
    </span>
  )
}


type Tab = "overview" | "campaigns" | "settings"
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "campaigns", label: "Campaigns" },
  { id: "settings", label: "Settings" },
]

export function ClientDetail({ clientSlug }: ClientDetailProps) {
  const [data, setData] = useState<SnapshotsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [configOverride, setConfigOverride] = useState<ClientConfig | null>(null)
  const [chartDays, setChartDays] = useState<14 | 30 | 60>(14)
  const [extendedHistory, setExtendedHistory] = useState<DailyPoint[] | null>(null)
  const [chartLoading, setChartLoading] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const rawTab = searchParams.get("tab")
  const activeTab: Tab =
    rawTab === "campaigns" || rawTab === "settings" ? rawTab : "overview"

  const setTab = useCallback(
    (tab: Tab) => {
      const params = new URLSearchParams(searchParams.toString())
      if (tab === "overview") {
        params.delete("tab")
      } else {
        params.set("tab", tab)
      }
      const qs = params.toString()
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false })
    },
    [searchParams, router, pathname],
  )

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics/snapshots")
      if (!res.ok) throw new Error("Failed to fetch")
      const json: SnapshotsResponse = await res.json()
      setData(json)
    } catch {
      // Keep previous data
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    setConfigOverride(null)
  }, [fetchData])

  // Find this client's data
  const clientData = data?.clients.find((c) => c.config.client === clientSlug)
  const rawConfig: ClientConfig | null = clientData?.config ?? null
  const config: ClientConfig | null = configOverride ?? rawConfig
  const snapshot: ClientSnapshot | null = clientData?.latest ?? null
  const history: DailyPoint[] = clientData?.history ?? []

  // Fetch extended history when chart range changes
  useEffect(() => {
    if (chartDays === 14) {
      setExtendedHistory(null)
      return
    }
    let cancelled = false
    async function fetchExtended() {
      setChartLoading(true)
      try {
        const res = await fetch(`/api/analytics/history?client=${clientSlug}&days=${chartDays}`)
        if (!cancelled && res.ok) {
          const json = await res.json()
          setExtendedHistory(json.history)
        }
      } catch {
        // Keep previous data
      } finally {
        if (!cancelled) setChartLoading(false)
      }
    }
    fetchExtended()
    return () => { cancelled = true }
  }, [chartDays, clientSlug])

  const chartData: DailyPoint[] = chartDays === 14 ? history : (extendedHistory ?? history)

  // Find siblings (same parent_client) for tab switcher
  const siblings =
    config?.parent_client && data
      ? data.clients.filter(
          (c) => c.config.parent_client === config.parent_client && c.config.is_active,
        )
      : []

  // Find campaigns for this client only (no unassigned leakage)
  const campaigns: CampaignSnapshot[] = data
    ? data.campaigns.filter((c) => c.client === clientSlug)
    : []
  // Compute status and derived values — use config overrides for thresholds/target
  const effectiveTarget = config?.daily_email_target ?? 1000
  const effectiveWarning = config?.runway_warning_days ?? 7
  const effectiveCritical = config?.runway_critical_days ?? 3
  const campaignDays = snapshot?.campaign_runway_days ?? 0
  const bankDays = snapshot?.pipeline_runway_days ?? 0
  const totalRunwayDays = Math.min(campaignDays, bankDays) > 0
    ? Math.min(campaignDays, bankDays)
    : campaignDays + bankDays
  const urgentDays = Math.min(campaignDays, bankDays)
  const status =
    urgentDays < effectiveCritical
      ? "critical" as const
      : urgentDays < effectiveWarning
        ? "warning" as const
        : "healthy" as const
  const leadsContacted = snapshot
    ? snapshot.leads_in_progress + snapshot.leads_completed + snapshot.leads_blocked
    : 0
  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          {/* Skeleton breadcrumb */}
          <SkeletonPulse className="h-4 w-36" />
          {/* Skeleton title */}
          <div className="mt-4 flex items-center gap-3">
            <SkeletonPulse className="h-7 w-48" />
            <SkeletonPulse className="h-5 w-16 rounded-full" />
          </div>
          {/* Skeleton accent bar */}
          <SkeletonPulse className="mt-4 h-0.5 w-full" />
          {/* Skeleton stat blocks */}
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonStatBlock key={i} />
            ))}
          </div>
          {/* Skeleton charts */}
          <div className="mt-10">
            <SkeletonPulse className="h-3 w-40 mb-3" />
            <SkeletonChart />
          </div>
          <div className="mt-8">
            <SkeletonPulse className="h-3 w-40 mb-3" />
            <SkeletonChart />
          </div>
          {/* Skeleton table rows */}
          <div className="mt-10">
            <SkeletonPulse className="h-3 w-24 mb-3" />
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonTableRow key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!snapshot || !config) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <Link
            href="/analytics"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Campaign Intelligence
          </Link>
          <div className="mt-8 text-center text-gray-500">
            No data found for segment &quot;{clientSlug.replace(/_/g, " ")}&quot;.
            Try running a refresh from the overview page.
          </div>
        </div>
      </div>
    )
  }

  const displayName = config.display_name

  const accentColor = {
    critical: "border-red-500",
    warning: "border-amber-500",
    healthy: "border-emerald-500",
  }[status]

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Breadcrumb */}
        <Link
          href="/analytics"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Campaign Intelligence
        </Link>

        {/* Page title + status badge */}
        <div className="mt-3 flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">{displayName}</h1>
          <StatusBadge status={status} />
        </div>

        {/* Colored accent bar matching health status */}
        <div className={`mt-4 border-t-2 ${accentColor}`} />

        {/* Sibling segment switcher (pill toggle for parent_client segments like Roosterpunk US/UK) */}
        {siblings.length > 1 && (
          <div className="mt-4 flex gap-1 rounded-full bg-gray-100 p-1 w-fit">
            {siblings.map((sib) => (
              <Link
                key={sib.config.client}
                href={`/analytics/${sib.config.client}`}
                className={`rounded-full px-4 py-1 text-sm font-medium transition-colors ${
                  sib.config.client === clientSlug
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {sib.config.display_name}
              </Link>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="mt-6 flex gap-6 border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`pb-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-sm ${
                activeTab === tab.id
                  ? "border-b-2 border-indigo-600 text-gray-900"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content: Overview */}
        {activeTab === "overview" && (
          <>
            {/* Lead pipeline funnel */}
            <div className="mt-6">
              <PipelineFunnel snapshot={snapshot} />
            </div>

            {/* Key metrics — 4 stat blocks */}
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white px-5 py-4">
                <RunwayMeter
                  campaignDays={campaignDays}
                  pipelineDays={bankDays}
                  warningDays={effectiveWarning}
                  criticalDays={effectiveCritical}
                />
              </div>
              {/* Yesterday Sends with WoW trend */}
              {(() => {
                const sendsTrend = computeTrend(chartData, "emails_sent_count")
                return (
                  <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-semibold tracking-tight text-gray-900">
                        {formatNumber(snapshot.emails_sent_count)}
                      </span>
                      {sendsTrend && <TrendBadge trend={sendsTrend} />}
                    </div>
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      Yesterday Sends
                    </span>
                    <span className="text-xs text-gray-400">vs prior 7-day avg</span>
                  </div>
                )
              })()}
              <PerformanceCard snapshot={snapshot} leadsContacted={leadsContacted} replyTrend={computeTrend(chartData, "positive_replies_count")} />
              {(() => {
                const mailboxCapacity = snapshot.mailbox_count * 30
                const utilization = mailboxCapacity > 0
                  ? (snapshot.emails_sent_count / mailboxCapacity) * 100
                  : 0
                const utilColor = utilization < 25 ? "text-red-600" : utilization < 50 ? "text-amber-600" : "text-gray-900"
                return (
                  <StatBlock
                    label="Capacity"
                    value={<span className={utilColor}>{utilization.toFixed(0)}%</span>}
                    sub={`${formatNumber(snapshot.emails_sent_count)} / ${formatNumber(mailboxCapacity)} mailbox capacity`}
                  />
                )
              })()}
              <StatBlock
                label="Leads Contacted"
                value={leadsContacted.toLocaleString()}
                sub="ever received email 1"
              />
              <StatBlock
                label="Total Sent"
                value={formatNumber(snapshot.all_time_emails_sent)}
                sub="lifetime emails delivered"
              />
              <StatBlock
                label="Total Replies"
                value={snapshot.all_time_interested.toLocaleString()}
                sub="interested leads lifetime"
              />
              {snapshot.all_time_interested > 0 && (
                <>
                  <StatBlock
                    label="Emails / Reply"
                    value={Math.round(snapshot.all_time_emails_sent / snapshot.all_time_interested).toLocaleString()}
                    sub={`${snapshot.all_time_interested} interested lifetime`}
                  />
                  <StatBlock
                    label="Leads / Reply"
                    value={leadsContacted > 0 ? Math.round(leadsContacted / snapshot.all_time_interested).toLocaleString() : "—"}
                    sub="leads reached per reply"
                  />
                </>
              )}
            </div>

            {/* Performance trend + campaign drivers */}
            <div className="mt-6">
              <PerformanceTrendChart
                chartData={chartData}
                campaigns={campaigns}
                clientSlug={clientSlug}
                snapshot={snapshot}
              />
            </div>

            {/* Chart date range selector */}
            <div className="mt-10 flex items-center gap-2" data-testid="chart-range-selector">
              {([14, 30, 60] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setChartDays(d)}
                  className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-colors ${
                    chartDays === d
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {d}D
                </button>
              ))}
              {chartLoading && (
                <span className="ml-2 text-xs text-gray-400">Loading...</span>
              )}
            </div>

            {/* Combined sends + replies chart */}
            <div className="mt-4">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                Sends &amp; Replies — last {chartDays} days
              </h2>
              <div className="mt-3 rounded-xl border border-gray-200 bg-white p-5">
                {chartData.length > 0 ? (
                  <CombinedChart data={chartData} dailyTarget={effectiveTarget} />
                ) : (
                  <div className="flex h-[180px] items-center justify-center text-gray-400">
                    No data available yet
                  </div>
                )}
              </div>
            </div>

            {/* Sends per day chart */}
            <div className="mt-8">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                Sends per day — last {chartDays} days
              </h2>
              <div className="mt-3 rounded-xl border border-gray-200 bg-white p-5">
                {chartData.length > 0 ? (
                  <SendsChart data={chartData} dailyTarget={effectiveTarget} />
                ) : (
                  <div className="flex h-64 items-center justify-center text-gray-400">
                    No send data available yet
                  </div>
                )}
              </div>
            </div>

            {/* Positive replies chart */}
            <div className="mt-8">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                Positive replies — last {chartDays} days
              </h2>
              <div className="mt-3 rounded-xl border border-gray-200 bg-white p-5">
                {chartData.length > 0 ? (
                  <RepliesChart data={chartData} />
                ) : (
                  <div className="flex h-64 items-center justify-center text-gray-400">
                    No reply data available yet
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Tab content: Campaigns */}
        {activeTab === "campaigns" && (
          <div className="mt-6">
            <CampaignTable
              campaigns={campaigns}
              clientSlug={clientSlug}
              dailyTarget={effectiveTarget}
            />
          </div>
        )}

        {/* Tab content: Settings */}
        {activeTab === "settings" && (
          <div className="mt-6">
            <SettingsPanel config={config} onConfigUpdate={setConfigOverride} />
          </div>
        )}
      </div>
    </div>
  )
}
