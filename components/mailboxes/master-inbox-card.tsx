import { Card, CardContent } from "@/components/ui/card"
import { Inbox, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MasterInboxInfo } from "@/lib/queries/mailboxes"

interface MasterInboxCardProps {
  info: MasterInboxInfo
}

export function MasterInboxCard({ info }: MasterInboxCardProps) {
  if (!info.exists) {
    return (
      <Card className="border-rose-200">
        <CardContent className="px-4 py-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 text-rose-600" />
            <div>
              <p className="text-sm font-medium text-rose-700">Master Inbox Missing</p>
              <p className="mt-1 text-xs text-muted-foreground">
                No dedicated master inbox set. Catch-all forwarding from burnt domains has no target.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const healthy = info.health !== null && info.health >= 97
  return (
    <Card>
      <CardContent className="px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-indigo-600" />
              <p className="text-sm font-medium">Master Inbox</p>
            </div>
            <p className="mt-1.5 truncate font-mono text-xs text-muted-foreground">
              {info.master_email}
            </p>
            <p className="truncate text-xs text-muted-foreground">{info.master_domain}</p>
          </div>
          {info.health !== null && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Health</p>
              <p className={cn("text-lg font-bold tabular-nums", healthy ? "text-emerald-600" : "text-amber-600")}>
                {info.health}%
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
