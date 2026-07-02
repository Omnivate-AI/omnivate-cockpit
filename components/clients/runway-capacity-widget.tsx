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

  const showUploadCallout = isFinite(campaignRunway) && campaignRunway < criticalDays
  const showEnrichmentCallout = isFinite(pipelineRunway) && pipelineRunway < criticalDays

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
              <span className={`text-sm font-semibold tabular-nums ${campaignRunwayColors.text}`}>
                {isFinite(campaignRunway) ? `${campaignRunway.toFixed(1)} days` : "N/A"}
              </span>
            </div>
            <ProgressBar
              value={campaignRunwayPct}
              showValue={false}
              thresholds={{ warning: Math.round((warningDays / warningDays) * 100), critical: Math.round((criticalDays / warningDays) * 100) }}
            />
          </div>

          {/* Pipeline Runway */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium">Pipeline Runway</span>
              <span className={`text-sm font-semibold tabular-nums ${pipelineRunwayColors.text}`}>
                {isFinite(pipelineRunway) ? `${pipelineRunway.toFixed(1)} days` : "N/A"}
              </span>
            </div>
            <ProgressBar
              value={pipelineRunwayPct}
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
              <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Campaign runway critically low — upload leads soon</span>
              </div>
            )}
            {showEnrichmentCallout && (
              <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
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
