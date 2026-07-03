import { AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProgressBar } from "@/components/shared/progress-bar"
import { runwayColor } from "@/lib/design-tokens"
import type { ClientSnapshot } from "@/types/analytics"
import type { ClientConfig } from "@/types/analytics"

interface RunwayCapacityWidgetProps {
  snapshot: ClientSnapshot | null
  config: ClientConfig
}

export function RunwayCapacityWidget({ snapshot, config }: RunwayCapacityWidgetProps) {
  if (!snapshot) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Runway &amp; Capacity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No snapshot data available</p>
        </CardContent>
      </Card>
    )
  }

  const warningDays = config.runway_warning_days ?? 14
  const criticalDays = config.runway_critical_days ?? 7

  const campaignRunway = snapshot.campaign_runway_days ?? 0
  const pipelineRunway = snapshot.pipeline_runway_days ?? 0

  // 999 is the "not tracked in sp_*" sentinel (lead-bank/pipeline runway)
  const campaignTracked = isFinite(campaignRunway) && campaignRunway < 999
  const pipelineTracked = isFinite(pipelineRunway) && pipelineRunway < 999

  const campaignRunwayColors = runwayColor(campaignRunway, warningDays, criticalDays)
  const pipelineRunwayColors = runwayColor(pipelineRunway, warningDays, criticalDays)

  // Capacity: emails sent yesterday vs estimated max
  const maxCapacity = snapshot.estimated_max_capacity ?? 0
  const emailsSent = snapshot.emails_sent_count ?? 0
  const capacityPct = maxCapacity > 0 ? Math.round((emailsSent / maxCapacity) * 100) : 0

  // Convert runway days to a percentage for the bar (capped at warningDays as 100%)
  const campaignRunwayPct = warningDays > 0
    ? Math.min(100, Math.round((campaignRunway / warningDays) * 100))
    : 0
  const pipelineRunwayPct = warningDays > 0
    ? Math.min(100, Math.round((pipelineRunway / warningDays) * 100))
    : 0

  const showUploadCallout = campaignTracked && campaignRunway < criticalDays
  const showEnrichmentCallout = pipelineTracked && pipelineRunway < criticalDays

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Runway &amp; Capacity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Campaign Runway */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium">Campaign Runway</span>
              <span className={`text-sm font-semibold tabular-nums ${campaignTracked ? campaignRunwayColors.text : "text-muted-foreground"}`}>
                {campaignTracked ? `${campaignRunway.toFixed(1)} days` : "Not tracked"}
              </span>
            </div>
            <ProgressBar
              value={campaignTracked ? campaignRunwayPct : 0}
              showValue={false}
              thresholds={{ warning: Math.round((warningDays / warningDays) * 100), critical: Math.round((criticalDays / warningDays) * 100) }}
            />
          </div>

          {/* Pipeline (lead-bank) Runway — not tracked in sp_* yet */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium">Pipeline Runway</span>
              <span className={`text-sm font-semibold tabular-nums ${pipelineTracked ? pipelineRunwayColors.text : "text-muted-foreground"}`}>
                {pipelineTracked ? `${pipelineRunway.toFixed(1)} days` : "Not tracked"}
              </span>
            </div>
            <ProgressBar
              value={pipelineTracked ? pipelineRunwayPct : 0}
              showValue={false}
              thresholds={{ warning: Math.round((warningDays / warningDays) * 100), critical: Math.round((criticalDays / warningDays) * 100) }}
            />
          </div>
        </div>

        {/* Capacity Gauge */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-medium">Sending Capacity</span>
            <span className="text-sm tabular-nums text-muted-foreground">
              {emailsSent.toLocaleString()} / {maxCapacity.toLocaleString()}
            </span>
          </div>
          <ProgressBar
            value={capacityPct}
            showValue={true}
            thresholds={{ warning: 60, critical: 30 }}
          />
        </div>

        {/* Callouts */}
        {(showUploadCallout || showEnrichmentCallout) && (
          <div className="space-y-2">
            {showUploadCallout && (
              <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Campaign runway critically low — upload leads soon</span>
              </div>
            )}
            {showEnrichmentCallout && (
              <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Pipeline runway critically low — run enrichment</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
