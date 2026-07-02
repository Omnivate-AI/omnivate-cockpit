import { ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ClientSnapshot } from "@/types/analytics"

interface FunnelStage {
  label: string
  count: number
  color: string
}

interface LeadPipelineFunnelProps {
  snapshot: ClientSnapshot | null
}

function conversionRate(from: number, to: number): string {
  if (from === 0) return "—"
  return `${((to / from) * 100).toFixed(1)}%`
}

export function LeadPipelineFunnel({ snapshot }: LeadPipelineFunnelProps) {
  if (!snapshot) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Lead Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No snapshot data available</p>
        </CardContent>
      </Card>
    )
  }

  const stages: FunnelStage[] = [
    { label: "Ready Leads", count: snapshot.ready_leads ?? 0, color: "bg-blue-100 border-blue-300 text-blue-800" },
    { label: "In Campaigns", count: snapshot.total_leads_in_campaigns ?? 0, color: "bg-violet-100 border-violet-300 text-violet-800" },
    { label: "Sent", count: snapshot.all_time_emails_sent ?? 0, color: "bg-amber-100 border-amber-300 text-amber-800" },
    { label: "Replies", count: snapshot.all_time_interested ?? 0, color: "bg-emerald-100 border-emerald-300 text-emerald-800" },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Lead Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-1 overflow-x-auto">
          {stages.map((stage, i) => (
            <div key={stage.label} className="flex items-center">
              <div className={`rounded-lg border px-4 py-3 text-center ${stage.color}`}>
                <p className="text-lg font-bold tabular-nums">{stage.count.toLocaleString()}</p>
                <p className="text-xs font-medium whitespace-nowrap">{stage.label}</p>
                {i < stages.length - 1 && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {conversionRate(stage.count, stages[i + 1].count)}
                  </p>
                )}
              </div>
              {i < stages.length - 1 && (
                <ChevronRight className="mx-1 h-5 w-5 shrink-0 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
