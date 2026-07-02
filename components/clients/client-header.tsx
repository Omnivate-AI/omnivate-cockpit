import Link from "next/link"
import { ChevronRight, Mail, MessageSquare, Inbox } from "lucide-react"
import type { ClientSnapshot } from "@/types/analytics"
import { ClientActionsDropdown } from "./client-actions-dropdown"
import { HealthRing } from "@/components/shared/health-ring"
import { computeClientHealthScore, type ClientHealthInput } from "@/lib/scoring/client-health"

type HealthStatus = "healthy" | "warning" | "critical" | "no-data"

function computeHealthStatus(
  latestSnapshot: ClientSnapshot | null,
  alertCount: number
): HealthStatus {
  if (!latestSnapshot) return "no-data"

  const sendRatio =
    latestSnapshot.daily_email_target > 0
      ? latestSnapshot.emails_sent_count / latestSnapshot.daily_email_target
      : 1
  if (sendRatio < 0.5) return "critical"

  if (alertCount > 0) return "warning"

  return "healthy"
}

const STATUS_CONFIG: Record<
  HealthStatus,
  {
    label: string
    text: string
    bg: string
    gradient: string
    gradientDark: string
  }
> = {
  healthy: {
    label: "Healthy",
    text: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-50 dark:bg-emerald-950/50",
    gradient: "from-emerald-50/80 via-white/60 to-white/40",
    gradientDark: "dark:from-emerald-950/40 dark:via-zinc-900/60 dark:to-zinc-900/40",
  },
  warning: {
    label: "Warning",
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950/50",
    gradient: "from-amber-50/80 via-white/60 to-white/40",
    gradientDark: "dark:from-amber-950/40 dark:via-zinc-900/60 dark:to-zinc-900/40",
  },
  critical: {
    label: "Critical",
    text: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-950/50",
    gradient: "from-rose-50/80 via-white/60 to-white/40",
    gradientDark: "dark:from-rose-950/40 dark:via-zinc-900/60 dark:to-zinc-900/40",
  },
  "no-data": {
    label: "No Data",
    text: "text-gray-500 dark:text-gray-400",
    bg: "bg-gray-100 dark:bg-gray-800/50",
    gradient: "from-gray-50/80 via-white/60 to-white/40",
    gradientDark: "dark:from-zinc-800/40 dark:via-zinc-900/60 dark:to-zinc-900/40",
  },
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`
  return n.toString()
}

interface ClientHeaderProps {
  clientSlug: string
  displayName: string
  latestSnapshot: ClientSnapshot | null
  alertCount: number
}

export function ClientHeader({
  clientSlug,
  displayName,
  latestSnapshot,
  alertCount,
}: ClientHeaderProps) {
  const status = computeHealthStatus(latestSnapshot, alertCount)
  const config = STATUS_CONFIG[status]

  const totalSent = latestSnapshot?.all_time_emails_sent ?? 0
  const interested = latestSnapshot?.all_time_interested ?? 0
  const replyRateNum = totalSent > 0 ? (interested / totalSent) * 100 : 0
  const replyRate = totalSent > 0 ? replyRateNum.toFixed(1) : "0"
  const mailboxCount = latestSnapshot?.mailbox_count ?? 0

  // Client health score
  const healthInput: ClientHealthInput = {
    avgMailboxHealth: null,
    sendAdherence: latestSnapshot && latestSnapshot.daily_email_target > 0
      ? latestSnapshot.emails_sent_count / latestSnapshot.daily_email_target
      : null,
    replyRate: latestSnapshot && totalSent > 0 ? replyRateNum : null,
    inboxPlacement: null,
    pendingAlerts: alertCount,
  }
  const healthResult = latestSnapshot ? computeClientHealthScore(healthInput) : null

  return (
    <div
      className={`sticky top-0 z-10 -mx-3 px-3 py-3 sm:-mx-6 sm:px-6 sm:py-4 backdrop-blur-sm bg-gradient-to-r ${config.gradient} ${config.gradientDark} border-b border-black/5 dark:border-white/5`}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left: Breadcrumb + Name + Status */}
        <div className="min-w-0 space-y-1">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link
              href="/"
              className="hover:text-foreground transition-colors"
            >
              Command Center
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate font-medium text-foreground capitalize">
              {displayName}
            </span>
          </nav>

          {/* Name + Health Ring + Status badge */}
          <div className="flex items-center gap-3">
            {healthResult && (
              <HealthRing
                score={healthResult.score}
                breakdown={healthResult.breakdown}
                size={48}
              />
            )}
            <h1 className="text-2xl font-semibold capitalize truncate">
              {displayName}
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0 ${config.text} ${config.bg}`}
            >
              {config.label}
            </span>
          </div>
        </div>

        {/* Right: Inline metrics + Actions */}
        <div className="flex items-center gap-6 shrink-0">
          {/* Inline metrics */}
          <div className="hidden sm:flex items-center gap-5">
            <div className="flex items-center gap-1.5 text-sm">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-semibold">{formatNumber(totalSent)}</span>
              <span className="text-muted-foreground">Sent</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-semibold">{replyRate}%</span>
              <span className="text-muted-foreground">Reply Rate</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Inbox className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-semibold">{mailboxCount}</span>
              <span className="text-muted-foreground">Mailboxes</span>
            </div>
          </div>

          {/* Actions */}
          <ClientActionsDropdown clientSlug={clientSlug} />
        </div>
      </div>
    </div>
  )
}
