import Link from "next/link"
import { GitCompareArrows } from "lucide-react"
import { getActiveClients } from "@/lib/queries/clients"
import { getClientCompareStats } from "@/lib/queries/analytics"
import { ClientSelector } from "@/components/compare/client-selector"
import { MetricSelector } from "@/components/compare/metric-selector"
import { ComparePanels } from "@/components/compare/compare-panels"
import { EmptyState } from "@/components/shared/empty-state"
import { SectionFreshness } from "@/components/shared/section-freshness"
import { COMPARE_METRIC_KEYS } from "@/lib/compare-metrics"
import { cn } from "@/lib/utils"

/**
 * V4 E1 — Compare rebuilt as a parameter picker: choose clients, choose any
 * of the six parameters (positive replies · reply rate · emails/positive ·
 * contacts/positive · volume · positive reply rate %), pick a range — each
 * parameter renders as a side-by-side panel. Formulas are shared with the
 * Command Center KPIs so the numbers never disagree across pages.
 */

const RANGE_PRESETS = [
  { key: "7d", days: 7, label: "Last 7 Days" },
  { key: "14d", days: 14, label: "Last 14 Days" },
  { key: "30d", days: 30, label: "Last 30 Days" },
]

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ clients?: string; metrics?: string; range?: string }>
}) {
  const params = await searchParams
  const allClients = await getActiveClients()

  // Parse selected clients from URL (any number — "click all my clients")
  const selectedRaw = params.clients?.split(",").filter(Boolean) ?? []
  const selected = selectedRaw.filter((c) => allClients.includes(c))

  // Parse selected metrics — absent param = all six
  const metricsRaw = params.metrics?.split(",").filter(Boolean) ?? []
  const validMetrics = metricsRaw.filter((m) => COMPARE_METRIC_KEYS.includes(m))
  const metricKeys = validMetrics.length > 0 ? validMetrics : COMPARE_METRIC_KEYS

  const range = RANGE_PRESETS.find((r) => r.key === params.range) ?? RANGE_PRESETS[1]

  const stats = selected.length >= 2 ? await getClientCompareStats(selected, range.days) : null

  const rangeHref = (key: string) => {
    const p = new URLSearchParams()
    if (params.clients) p.set("clients", params.clients)
    if (params.metrics) p.set("metrics", params.metrics)
    p.set("range", key)
    return `/compare?${p.toString()}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Client Comparison</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick clients and parameters — every selected parameter compares side by side
        </p>
        <SectionFreshness className="mt-1.5" />
      </div>

      {/* Client multi-select */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-2">
          Clients ({selected.length} selected)
        </p>
        <ClientSelector allClients={allClients} selected={selected} />
      </div>

      {/* Parameter multi-select (V4 E1) */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-2">
          Parameters ({metricKeys.length}/{COMPARE_METRIC_KEYS.length} selected)
        </p>
        <MetricSelector selected={metricKeys} />
      </div>

      {/* Range presets — plain links, zero client JS */}
      <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
        {RANGE_PRESETS.map((r) => (
          <Link
            key={r.key}
            href={rangeHref(r.key)}
            aria-current={range.key === r.key ? "true" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              range.key === r.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {r.label}
          </Link>
        ))}
      </div>

      {/* Panels or empty state */}
      {stats ? (
        <ComparePanels stats={stats} metricKeys={metricKeys} rangeLabel={range.label} />
      ) : (
        <EmptyState
          icon={GitCompareArrows}
          title="Select at least 2 clients to compare"
          description="Choose clients above, then pick any combination of parameters — positive replies, reply rate, the two efficiency ratios, volume, and positive reply rate %."
        />
      )}
    </div>
  )
}
