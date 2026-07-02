"use client"

import { useState, useCallback, useEffect, Fragment } from "react"
import { ChevronDown, ChevronUp, ArrowUpDown, TrendingUp, TrendingDown, Search, X } from "lucide-react"
import type { CampaignSnapshot, CampaignHistoryResponse } from "@/types/analytics"
import { formatCampaignName } from "@/lib/utils"
import { SparklineChart } from "./SparklineChart"

interface CampaignTableProps {
  campaigns: CampaignSnapshot[]
  clientSlug: string
  dailyTarget: number
}

type SortKey =
  | "campaign_name"
  | "leads_not_started"
  | "leads_in_progress"
  | "leads_completed"
  | "all_time_emails_sent"
  | "all_time_interested"
  | "grade"
  | "emails_per_reply"
  | "leads_per_reply"
  | "mailbox_count"

type SortDir = "asc" | "desc"

interface Grade {
  label: string
  textColor: string
  bgColor: string
  sortVal: number
}

function getGrade(leadsPerReply: number | null): Grade {
  if (leadsPerReply === null) return { label: "No data",   textColor: "text-gray-500",   bgColor: "bg-gray-100",   sortVal: 999 }
  if (leadsPerReply <= 150)  return { label: "Excellent",  textColor: "text-emerald-700", bgColor: "bg-emerald-50", sortVal: 1 }
  if (leadsPerReply <= 400)  return { label: "Above Avg",  textColor: "text-teal-700",    bgColor: "bg-teal-50",    sortVal: 2 }
  if (leadsPerReply <= 800)  return { label: "Average",    textColor: "text-amber-700",   bgColor: "bg-amber-50",   sortVal: 3 }
  if (leadsPerReply <= 1200) return { label: "Poor",  textColor: "text-orange-700",  bgColor: "bg-orange-50",  sortVal: 4 }
  return                            { label: "Fail", textColor: "text-red-700",     bgColor: "bg-red-50",     sortVal: 5 }
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`
  return n.toLocaleString()
}

function isSubsequenceByName(name: string): boolean {
  return /sub_sequence|subsequence|follow.?up|_sub_seq|_sub$/i.test(name)
}

function InlineExpansion({
  campaign,
  dailyTarget,
}: {
  campaign: CampaignSnapshot
  dailyTarget: number
}) {
  const [history, setHistory] = useState<CampaignSnapshot[] | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/analytics/snapshots?campaign_id=${campaign.campaign_id}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const json: CampaignHistoryResponse = await res.json()
      setHistory(json.history)
    } catch {
      setHistory([])
    } finally {
      setLoading(false)
    }
  }, [campaign.campaign_id])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  if (loading) {
    return (
      <div className="px-6 py-4 text-sm text-gray-400">Loading campaign history...</div>
    )
  }

  const sends = (history || []).map((h) => h.emails_sent)
  const replies = (history || []).map((h) => h.positive_replies)

  const last7 = replies.slice(-7)
  const prior7 = replies.slice(-14, -7)
  const last7Avg = last7.length > 0 ? last7.reduce((a, b) => a + b, 0) / last7.length : 0
  const prior7Avg = prior7.length > 0 ? prior7.reduce((a, b) => a + b, 0) / prior7.length : 0
  const trendPct = prior7Avg > 0 ? ((last7Avg - prior7Avg) / prior7Avg) * 100 : 0
  const trendUp = last7Avg >= prior7Avg

  const yesterdaySends = sends.length > 0 ? sends[sends.length - 1] : 0
  const seqLen = campaign.sequence_length || 3
  const remainingEmails =
    campaign.leads_not_started * seqLen +
    campaign.leads_in_progress * Math.ceil(seqLen / 2)
  const campaignRunway = yesterdaySends > 0 ? remainingEmails / yesterdaySends : 0

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Sends — 14 days
          </span>
          <div className="mt-1">
            <SparklineChart data={sends} type="sends" target={dailyTarget} />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Replies — 14 days
            </span>
            {prior7Avg > 0 && (
              <span
                className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${trendUp ? "text-emerald-600" : "text-red-600"}`}
              >
                {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {trendUp ? "+" : ""}
                {trendPct.toFixed(0)}%
              </span>
            )}
          </div>
          <div className="mt-1">
            <SparklineChart data={replies} type="replies" />
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
        <span>
          Mailboxes: <strong className="text-gray-900">{campaign.mailbox_count}</strong>
        </span>
        <span>
          Campaign Runway:{" "}
          <strong className={campaignRunway > 0 && campaignRunway < 3 ? "text-red-600" : campaignRunway > 0 && campaignRunway < 7 ? "text-amber-600" : "text-gray-900"}>
            {campaignRunway > 0 ? `${campaignRunway.toFixed(1)}d` : "—"}
          </strong>
        </span>
      </div>
    </div>
  )
}

export function CampaignTable({ campaigns, clientSlug, dailyTarget }: CampaignTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("grade")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState("")

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const [subOpen, setSubOpen] = useState(false)

  const clientCampaigns = campaigns.filter((c) => c.client === clientSlug)
  const searchLower = search.toLowerCase()
  const primaryCampaigns = clientCampaigns.filter(
    (c) => c.campaign_type !== "subsequence" && !isSubsequenceByName(c.campaign_name) && (!search || c.campaign_name.toLowerCase().includes(searchLower))
  )
  const subsequenceCampaigns = clientCampaigns.filter(
    (c) => (c.campaign_type === "subsequence" || isSubsequenceByName(c.campaign_name)) && (!search || c.campaign_name.toLowerCase().includes(searchLower))
  )
  const unassigned = campaigns.filter((c) => c.client === "unassigned")

  const noResults = search && primaryCampaigns.length === 0 && subsequenceCampaigns.length === 0

  function getLeadsPerReply(c: CampaignSnapshot): number | null {
    const lc = c.leads_in_progress + c.leads_completed + c.leads_blocked
    return c.all_time_interested > 0 && lc > 0 ? lc / c.all_time_interested : null
  }

  function getCampaignSortValue(c: CampaignSnapshot, key: SortKey): number | string {
    if (key === "grade") return getGrade(getLeadsPerReply(c)).sortVal
    if (key === "emails_per_reply") {
      return c.all_time_interested > 0 ? c.all_time_emails_sent / c.all_time_interested : Infinity
    }
    if (key === "leads_per_reply") {
      const lpr = getLeadsPerReply(c)
      return lpr !== null ? lpr : Infinity
    }
    return (c as unknown as Record<string, unknown>)[key] as number | string
  }

  const sorted = [...primaryCampaigns].sort((a, b) => {
    const aVal = getCampaignSortValue(a, sortKey)
    const bVal = getCampaignSortValue(b, sortKey)
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    }
    const numA = Number(aVal)
    const numB = Number(bVal)
    return sortDir === "asc" ? numA - numB : numB - numA
  })

  const getUnsentColour = (unsent: number): string => {
    if (unsent < 200) return "text-red-600"
    if (unsent < 500) return "text-amber-600"
    return "text-gray-700"
  }

  const columns: { key: SortKey; label: string; className?: string }[] = [
    { key: "campaign_name",       label: "Campaign",      className: "text-left" },
    { key: "grade",               label: "Grade",         className: "text-left" },
    { key: "leads_per_reply",     label: "Leads / Reply"  },
    { key: "emails_per_reply",    label: "Emails / Reply" },
    { key: "all_time_interested", label: "Interested"     },
    { key: "leads_not_started",   label: "Not Started"    },
    { key: "leads_in_progress",   label: "In Progress"    },
    { key: "leads_completed",     label: "Completed"      },
    { key: "all_time_emails_sent",label: "Sent"           },
    { key: "mailbox_count",       label: "Mailboxes"      },
  ]

  function renderCampaignRow(campaign: CampaignSnapshot, idx: number, isSubsequence = false) {
    const isExpanded = expandedIds.has(campaign.campaign_id)
    const lpr = getLeadsPerReply(campaign)
    const grade = getGrade(lpr)
    const epr = campaign.all_time_interested > 0
      ? Math.round(campaign.all_time_emails_sent / campaign.all_time_interested)
      : null

    return (
      <Fragment key={campaign.campaign_id}>
        <tr className={`group border-b border-gray-100 transition-colors duration-150 hover:bg-gray-50 ${isSubsequence ? "opacity-65" : ""}`}>
          {/* Campaign name */}
          <td className="px-4 py-3 text-left font-medium text-gray-900 truncate max-w-[220px]" title={campaign.campaign_name}>
            {(() => {
              const { displayName, version } = formatCampaignName(campaign.campaign_name)
              return (
                <>
                  {displayName}
                  {version && (
                    <span className="ml-1 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                      {version}
                    </span>
                  )}
                  {isSubsequence && (
                    <span className="ml-1.5 bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-[10px] font-medium">
                      Subsequence
                    </span>
                  )}
                </>
              )
            })()}
          </td>
          {/* Grade pill */}
          <td className="px-4 py-3 text-left">
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${grade.bgColor} ${grade.textColor}`}>
              {grade.label}
            </span>
          </td>
          {/* Leads / Reply */}
          <td className="px-4 py-3 text-right text-gray-700 tabular-nums font-medium">
            {lpr !== null ? Math.round(lpr).toLocaleString() : "—"}
          </td>
          {/* Emails / Reply */}
          <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
            {epr !== null ? epr.toLocaleString() : "—"}
          </td>
          {/* Interested */}
          <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
            {formatNumber(campaign.all_time_interested)}
          </td>
          {/* Not Started */}
          <td className={`px-4 py-3 text-right tabular-nums ${getUnsentColour(campaign.leads_not_started)}`}>
            {formatNumber(campaign.leads_not_started)}
          </td>
          {/* In Progress */}
          <td className="px-4 py-3 text-right tabular-nums text-blue-600">
            {formatNumber(campaign.leads_in_progress)}
          </td>
          {/* Completed */}
          <td className="px-4 py-3 text-right tabular-nums text-emerald-600">
            {formatNumber(campaign.leads_completed)}
          </td>
          {/* Sent */}
          <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
            {formatNumber(campaign.all_time_emails_sent)}
          </td>
          {/* Mailboxes */}
          <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
            {campaign.mailbox_count}
          </td>
          {/* Expand */}
          <td className="px-2 py-3 text-center">
            <button
              onClick={() => toggleExpand(campaign.campaign_id)}
              className="inline-flex items-center justify-center rounded-md p-1 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              aria-label={isExpanded ? "Collapse campaign details" : "Expand campaign details"}
            >
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
            </button>
          </td>
        </tr>
        {isExpanded && (
          <tr>
            <td colSpan={11} className="p-0">
              <InlineExpansion campaign={campaign} dailyTarget={dailyTarget} />
            </td>
          </tr>
        )}
      </Fragment>
    )
  }

  if (clientCampaigns.length === 0 && unassigned.length === 0) {
    return (
      <div className="text-sm text-gray-500">No campaigns found for this segment.</div>
    )
  }

  return (
    <div>
      {/* Search input */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search campaigns..."
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {noResults ? (
        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-12 text-sm text-gray-500">
          No campaigns match your search
        </div>
      ) : (
        <>
          <div className="overflow-hidden overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`cursor-pointer select-none whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 transition-colors hover:text-gray-700 ${col.className ?? "text-right"}`}
                      onClick={() => toggleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortKey === col.key ? (
                          sortDir === "asc" ? (
                            <ChevronUp className="h-3 w-3 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-3 w-3 text-gray-400" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-gray-300" />
                        )}
                      </span>
                    </th>
                  ))}
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((campaign, idx) => renderCampaignRow(campaign, idx, false))}
              </tbody>
            </table>
          </div>

          {/* Subsequences section */}
          {subsequenceCampaigns.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setSubOpen((o) => !o)}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                <ChevronDown
                  className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${subOpen ? "rotate-180" : ""}`}
                />
                Subsequences ({subsequenceCampaigns.length})
              </button>

              {subOpen && (
                <div className="mt-2 overflow-hidden overflow-x-auto rounded-xl border border-gray-200 bg-white">
                  <table className="w-full min-w-[1000px] text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        {columns.map((col) => (
                          <th
                            key={col.key}
                            className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 ${col.className ?? "text-right"}`}
                          >
                            {col.label}
                          </th>
                        ))}
                        <th className="px-2 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {subsequenceCampaigns.map((campaign, idx) => renderCampaignRow(campaign, idx, true))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
