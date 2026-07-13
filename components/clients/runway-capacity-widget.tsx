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

  // 999 is the "not tracked in sp_*" sentinel
  const campaignTracked = isFinite(campaignRunway) && campaignRunway < 999

  const campaignRunwayColors = runwayColor(campaignRunway, warningDays, criticalDays)

  // Capacity: emails sent yesterday vs estimated max
  const maxCapacity = snapshot.estimated_max_capacity ?? 0
  const emailsSent = snapshot.emails_sent_count ?? 0
  const capacityPct = maxCapacity > 0 ? Math.round((emailsSent / maxCapacity) * 100) : 0

  // Convert runway days to a percentage for the bar (capped at warningDays as 100%)
  const campaignRunwayPct = warningDays > 0
    ? Math.min(100, Math.round((campaignRunway / warningDays) * 100))
    : 0

  const showUploadCallout = campaignTracked && campaignRunway < criticalDays

  // "Pipeline Runway" element removed (V2 Phase 1) — the Ready Bank card
  // above tells the lead-bank story; this card keeps campaign runway +
  // capacity-used only.
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Runway &amp; Capacity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
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
        {showUploadCallout && (
          <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Campaign runway critically low — upload leads soon</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
