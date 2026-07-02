"use client"

import { useState } from "react"
import { TestTube2, ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { FreshnessBadge } from "@/components/shared/freshness-badge"
import type { PlacementTestResult } from "@/lib/queries/campaigns"
import { PlacementTrendChart } from "./placement-trend-chart"

interface PlacementTabProps {
  results: PlacementTestResult[]
}

function statusBadge(inboxPct: number) {
  if (inboxPct > 90) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
        Good
      </span>
    )
  }
  if (inboxPct >= 70) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
        Warning
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-400">
      Poor
    </span>
  )
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function PlacementTab({ results }: PlacementTabProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null)

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <TestTube2 className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 font-medium">No Placement Data</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          No inbox placement tests have been run for this client yet.
        </p>
      </div>
    )
  }

  const latestTestDate = results[0]?.test_date ?? null

  return (
    <div className="space-y-6">
      <div className="flex justify-end mb-1">
        <FreshnessBadge date={latestTestDate} />
      </div>
      <div className="rounded-md border p-4">
        <h3 className="text-sm font-medium mb-3">Inbox Placement Trend (Last 30 Days)</h3>
        <PlacementTrendChart results={results} />
      </div>
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium w-8"></th>
              <th className="px-4 py-3 text-left font-medium">Campaign</th>
              <th className="px-4 py-3 text-left font-medium">Test Date</th>
              <th className="px-4 py-3 text-right font-medium">Inbox %</th>
              <th className="px-4 py-3 text-right font-medium">Spam %</th>
              <th className="px-4 py-3 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const isExpanded = expandedId === r.id
              return (
                <PlacementRow
                  key={r.id}
                  result={r}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedId(isExpanded ? null : r.id)}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PlacementRow({
  result,
  isExpanded,
  onToggle,
}: {
  result: PlacementTestResult
  isExpanded: boolean
  onToggle: () => void
}) {
  const hasBreakdown =
    result.provider_breakdown && Object.keys(result.provider_breakdown).length > 0

  return (
    <>
      <tr
        className={cn(
          "border-b transition-colors hover:bg-muted/50 cursor-pointer",
          isExpanded && "bg-muted/30"
        )}
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          {hasBreakdown ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <span className="inline-block w-4" />
          )}
        </td>
        <td className="px-4 py-3 font-medium">{result.campaign_name}</td>
        <td className="px-4 py-3 text-muted-foreground">
          {formatDate(result.test_date)}
        </td>
        <td className="px-4 py-3 text-right">
          <span
            className={cn(
              "font-medium",
              (result.inbox_pct ?? 0) > 90
                ? "text-emerald-600 dark:text-emerald-400"
                : (result.inbox_pct ?? 0) >= 70
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-rose-600 dark:text-rose-400"
            )}
          >
            {(result.inbox_pct ?? 0).toFixed(1)}%
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <span
            className={cn(
              "font-medium",
              (result.spam_pct ?? 0) > 10
                ? "text-rose-600 dark:text-rose-400"
                : "text-muted-foreground"
            )}
          >
            {(result.spam_pct ?? 0).toFixed(1)}%
          </span>
        </td>
        <td className="px-4 py-3 text-center">{statusBadge(result.inbox_pct ?? 0)}</td>
      </tr>
      {isExpanded && hasBreakdown && (
        <tr className="border-b bg-muted/20">
          <td colSpan={6} className="px-8 py-4">
            <ProviderBreakdown breakdown={result.provider_breakdown!} />
          </td>
        </tr>
      )}
    </>
  )
}

function ProviderBreakdown({
  breakdown,
}: {
  breakdown: Record<string, unknown>
}) {
  const entries = Object.entries(breakdown)

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Provider Breakdown
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {entries.map(([provider, data]) => {
          const d = data as Record<string, number> | null
          const inbox = d?.inbox_pct ?? d?.inbox ?? 0
          const spam = d?.spam_pct ?? d?.spam ?? 0
          return (
            <div
              key={provider}
              className="rounded-lg border bg-background p-3 text-sm"
            >
              <p className="font-medium capitalize">{provider}</p>
              <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                <span
                  className={cn(
                    inbox > 90
                      ? "text-emerald-600 dark:text-emerald-400"
                      : inbox >= 70
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-rose-600 dark:text-rose-400"
                  )}
                >
                  Inbox: {typeof inbox === "number" ? inbox.toFixed(0) : inbox}%
                </span>
                <span
                  className={cn(
                    spam > 10
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-muted-foreground"
                  )}
                >
                  Spam: {typeof spam === "number" ? spam.toFixed(0) : spam}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
