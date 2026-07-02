"use client"

import { useMemo } from "react"
import { HEALTH_THRESHOLDS } from "@/lib/design-tokens"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { DomainInfo } from "@/lib/scoring/burn-prediction"
import type { ClientMailboxRow } from "@/lib/queries/mailboxes"

interface DomainHealthHeatmapProps {
  domains: DomainInfo[]
  mailboxes: ClientMailboxRow[]
  selectedDomain: string | null
  onDomainClick: (domainName: string | null) => void
}

function getDomainColor(health: number | null, isBurnt: boolean): string {
  if (isBurnt) return "#991b1b" // dark red (red-800)
  if (health == null) return "#d1d5db" // gray-300
  if (health >= HEALTH_THRESHOLDS.healthy) return "#10b981" // emerald-500
  if (health >= HEALTH_THRESHOLDS.warning) return "#f59e0b" // amber-500
  return "#f43f5e" // rose-500
}

export function DomainHealthHeatmap({
  domains,
  mailboxes,
  selectedDomain,
  onDomainClick,
}: DomainHealthHeatmapProps) {
  const domainStats = useMemo(() => {
    // Count accounts per domain
    const countByDomain = new Map<string, number>()
    const burntByDomain = new Set<string>()

    for (const m of mailboxes) {
      countByDomain.set(m.domain_name, (countByDomain.get(m.domain_name) ?? 0) + 1)
      if (m.lifecycle_status === "burnt") {
        burntByDomain.add(m.domain_name)
      }
    }

    return domains
      .map((d) => ({
        ...d,
        accountCount: countByDomain.get(d.domain_name) ?? 0,
        isBurnt: d.lifecycle_status === "burnt" || burntByDomain.has(d.domain_name),
      }))
      .sort((a, b) => (a.latest_warmup_health ?? 0) - (b.latest_warmup_health ?? 0))
  }, [domains, mailboxes])

  if (domains.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Domain Health</p>
        {selectedDomain && (
          <button
            onClick={() => onDomainClick(null)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear filter
          </button>
        )}
      </div>
      <TooltipProvider delayDuration={150}>
        <div className="flex flex-wrap gap-1.5">
          {domainStats.map((d) => {
            const color = getDomainColor(d.latest_warmup_health, d.isBurnt)
            const isSelected = selectedDomain === d.domain_name
            return (
              <Tooltip key={d.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() =>
                      onDomainClick(isSelected ? null : d.domain_name)
                    }
                    className="h-7 w-7 rounded-sm transition-all"
                    style={{
                      backgroundColor: color,
                      opacity: selectedDomain && !isSelected ? 0.3 : 1,
                      outline: isSelected
                        ? "2px solid currentColor"
                        : "none",
                      outlineOffset: "1px",
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <p className="font-medium">{d.domain_name}</p>
                    <p>
                      Health:{" "}
                      {d.latest_warmup_health != null
                        ? `${d.latest_warmup_health}%`
                        : "N/A"}
                    </p>
                    <p>
                      {d.accountCount} account{d.accountCount !== 1 ? "s" : ""}
                    </p>
                    {d.isBurnt && (
                      <p className="text-red-300 font-medium">Burnt</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </TooltipProvider>
      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#10b981" }} />
          &gt;97%
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#f59e0b" }} />
          85-97%
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#f43f5e" }} />
          &lt;85%
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#991b1b" }} />
          Burnt
        </span>
      </div>
    </div>
  )
}
