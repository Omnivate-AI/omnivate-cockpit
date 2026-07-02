"use client"

interface RunwayMeterProps {
  campaignDays: number
  pipelineDays: number
  warningDays: number
  criticalDays: number
  compact?: boolean
  // Legacy single-value props (kept for any detail-page usage)
  totalDays?: number
  bankDays?: number
}

function getStatus(days: number, warningDays: number, criticalDays: number) {
  if (days < criticalDays) return "critical"
  if (days < warningDays) return "warning"
  return "healthy"
}

export function RunwayMeter({
  campaignDays,
  pipelineDays,
  warningDays,
  criticalDays,
  compact = false,
}: RunwayMeterProps) {
  const campaignStatus = getStatus(campaignDays, warningDays, criticalDays)
  const pipelineStatus = getStatus(pipelineDays, warningDays, criticalDays)

  const maxDays = Math.max(warningDays * 2, 30)

  const campaignPct = Math.min((campaignDays / maxDays) * 100, 100)
  const pipelinePct = Math.min((pipelineDays / maxDays) * 100, 100)

  const barColor = {
    critical: "bg-red-500",
    warning: "bg-amber-500",
    healthy: "bg-indigo-400",
  }

  const pipelineBarColor = {
    critical: "bg-red-300",
    warning: "bg-amber-300",
    healthy: "bg-teal-400",
  }

  const textColor = {
    critical: "text-red-600",
    warning: "text-amber-600",
    healthy: "text-gray-900",
  }

  if (compact) {
    return (
      <div className="flex gap-1.5 items-center">
        <div className="h-1.5 w-8 rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${barColor[campaignStatus]} transition-all`}
            style={{ width: `${campaignPct}%` }}
          />
        </div>
        <div className="h-1.5 w-8 rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${pipelineBarColor[pipelineStatus]} transition-all`}
            style={{ width: `${pipelinePct}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Campaign runway */}
      <div className="space-y-1">
        <span className={`text-xl font-bold tabular-nums ${textColor[campaignStatus]}`}>
          {campaignDays.toFixed(1)}
          <span className="ml-0.5 text-xs font-normal text-gray-400">d</span>
        </span>
        <div className="h-1.5 w-full rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${barColor[campaignStatus]} transition-all duration-500`}
            style={{ width: `${campaignPct}%` }}
          />
        </div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Campaign</p>
        <p className="text-[10px] text-gray-400 leading-tight">leads in Smartlead</p>
      </div>

      {/* Pipeline runway */}
      <div className="space-y-1">
        <span className={`text-xl font-bold tabular-nums ${textColor[pipelineStatus]}`}>
          {pipelineDays.toFixed(1)}
          <span className="ml-0.5 text-xs font-normal text-gray-400">d</span>
        </span>
        <div className="h-1.5 w-full rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${pipelineBarColor[pipelineStatus]} transition-all duration-500`}
            style={{ width: `${pipelinePct}%` }}
          />
        </div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Pipeline</p>
        <p className="text-[10px] text-gray-400 leading-tight">ready bank</p>
      </div>
    </div>
  )
}
