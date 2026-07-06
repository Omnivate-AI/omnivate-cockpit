import Link from "next/link"
import { Bell, Rocket, Database } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { ProgressBar } from "@/components/shared/progress-bar"
import { HealthRing } from "@/components/shared/health-ring"
import { replyRateColor, runwayColor } from "@/lib/design-tokens"
import { computeClientHealthScore, type ClientHealthInput } from "@/lib/scoring/client-health"
import type { ClientConfig, ClientSnapshot } from "@/types/analytics"
import { cn } from "@/lib/utils"

export type HealthStatus = "healthy" | "warning" | "critical" | "no-data"

export function computeHealthStatus(
  config: ClientConfig,
  latest: ClientSnapshot | null,
  alertCount: number
): HealthStatus {
  if (!latest) return "no-data"

  const runway = Math.min(
    latest.campaign_runway_days ?? Infinity,
    latest.pipeline_runway_days ?? Infinity
  )

  if (runway < config.runway_critical_days) return "critical"
  if (runway < config.runway_warning_days || alertCount > 0) return "warning"
  return "healthy"
}

const STATUS_CONFIG: Record<HealthStatus, { label: string; text: string; bg: string }> = {
  healthy: {
    label: "Healthy",
    text: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-50 dark:bg-emerald-950/50",
  },
  warning: {
    label: "Warning",
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950/50",
  },
  critical: {
    label: "Critical",
    text: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-950/50",
  },
  "no-data": {
    label: "No Data",
    text: "text-gray-500 dark:text-gray-400",
    bg: "bg-gray-100 dark:bg-gray-800/50",
  },
}

export interface ClientInfraBadge {
  nonRetired: number
  atRisk: number
  listed: number
}

interface ClientSummaryCardProps {
  config: ClientConfig
  latest: ClientSnapshot | null
  alertCount: number
  periodDays?: number
  /** Infra roll-up from vw_cockpit_portfolio_health (PORT-2). */
  infra?: ClientInfraBadge
}

export function ClientSummaryCard({ config, latest, alertCount, periodDays = 1, infra }: ClientSummaryCardProps) {
  const status = computeHealthStatus(config, latest, alertCount)
  const statusCfg = STATUS_CONFIG[status]

  // Send progress: percentage of period target hit (scale daily target by days)
  const periodTarget = config.daily_email_target * periodDays
  const sendPct =
    latest && periodTarget > 0
      ? (latest.emails_sent_count / periodTarget) * 100
      : 0

  // Reply rate
  const replyRate =
    latest && latest.all_time_emails_sent > 0
      ? (latest.all_time_interested / latest.all_time_emails_sent) * 100
      : 0
  const replyColors = replyRateColor(replyRate)

  // Client health score
  const healthInput: ClientHealthInput = {
    avgMailboxHealth: null, // not available at summary level
    sendAdherence: periodTarget > 0 && latest
      ? latest.emails_sent_count / periodTarget
      : null,
    replyRate: latest && latest.all_time_emails_sent > 0 ? replyRate : null,
    inboxPlacement: null, // not available at summary level
    pendingAlerts: alertCount,
  }
  const healthResult = latest ? computeClientHealthScore(healthInput) : null

  // Runway values (keep for health status computation)
  const _runway = latest
    ? Math.min(
        latest.campaign_runway_days ?? Infinity,
        latest.pipeline_runway_days ?? Infinity
      )
    : 0

  return (
    <Link href={`/clients/${config.client}`} className="block">
      <Card className="transition-all duration-200 hover:border-foreground/20 hover:-translate-y-0.5 hover:shadow-lg">
        <CardContent className="p-5 space-y-3">
          {/* Header: name + ring + badge */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              {healthResult && (
                <HealthRing
                  score={healthResult.score}
                  breakdown={healthResult.breakdown}
                  size={40}
                />
              )}
              <h3 className="font-semibold capitalize truncate">
                {config.display_name}
              </h3>
            </div>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold shrink-0",
                statusCfg.text,
                statusCfg.bg
              )}
            >
              {statusCfg.label}
            </span>
          </div>

          {/* Send progress — only meaningful when a target is configured */}
          {periodTarget > 0 ? (
            <ProgressBar
              value={Math.min(sendPct, 100)}
              label="Sends vs Target"
              thresholds={{ warning: 100, critical: 50 }}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              No daily send target set — configure in client Settings
            </p>
          )}

          {/* Lead runway across ACTIVE PRIMARY campaigns (Omar 2026-07-06):
              one glance = how much of the loaded lead bank is still left.
              Follow-up/referral campaigns are excluded upstream
              (vw_cockpit_client_runway). */}
          {latest &&
            latest.leads_not_started +
              latest.leads_in_progress +
              latest.leads_completed >
              0 && (
              <LeadRunwayBar
                notStarted={latest.leads_not_started}
                inProgress={latest.leads_in_progress}
                completed={latest.leads_completed}
                campaigns={latest.primary_active_campaigns}
              />
            )}

          {/* Runway: campaign + pipeline side by side */}
          {latest ? (
            <div className="grid grid-cols-2 gap-2">
              <RunwayGauge
                icon={Rocket}
                label="In Campaigns"
                days={latest.campaign_runway_days}
                leads={latest.unsent_campaign_leads}
                warningDays={config.runway_warning_days}
                criticalDays={config.runway_critical_days}
                detail={
                  latest.remaining_emails != null && latest.daily_capacity > 0
                    ? `${formatLeads(latest.remaining_emails)} emails ÷ ${latest.daily_capacity.toLocaleString()}/day`
                    : undefined
                }
              />
              <RunwayGauge
                icon={Database}
                label="Ready Bank"
                days={latest.pipeline_runway_days}
                leads={latest.ready_leads}
                warningDays={config.runway_warning_days}
                criticalDays={config.runway_critical_days}
              />
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-1">No runway data</div>
          )}

          {/* Infra health line (PORT-2: perf + infra on one screen) */}
          {infra && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t pt-2 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {infra.nonRetired.toLocaleString()} boxes
              </span>
              <span
                className={cn(
                  "tabular-nums",
                  infra.atRisk > 0 &&
                    "font-medium text-amber-600 dark:text-amber-400"
                )}
              >
                {infra.atRisk} at-risk
              </span>
              <span
                className={cn(
                  "tabular-nums",
                  infra.listed > 0 &&
                    "font-semibold text-rose-600 dark:text-rose-400"
                )}
              >
                {infra.listed} blacklisted
              </span>
            </div>
          )}

          {/* Bottom row: reply rate + alerts */}
          <div className="flex items-center justify-between text-xs">
            <span className={cn("tabular-nums font-medium", replyColors.text)}>
              {replyRate > 0 ? `${replyRate.toFixed(1)}% reply` : "N/A"}
            </span>
            {alertCount > 0 && (
              <span className="inline-flex items-center gap-1 text-rose-600 font-medium">
                <Bell className="h-3 w-3" />
                {alertCount}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function formatLeads(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`
  return n.toLocaleString()
}

/**
 * Omar's "runway slider": completed → in progress → not started across the
 * client's ACTIVE PRIMARY campaigns, summed. Emerald = fuel still in the
 * tank; when the emerald segment vanishes the client is out of leads.
 */
function LeadRunwayBar({
  notStarted,
  inProgress,
  completed,
  campaigns,
}: {
  notStarted: number
  inProgress: number
  completed: number
  campaigns?: number
}) {
  const total = notStarted + inProgress + completed
  if (total <= 0) return null
  const pct = (n: number) => (n / total) * 100

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Lead Runway
          {campaigns != null && campaigns > 0 ? ` · ${campaigns} primary` : ""}
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {formatLeads(notStarted)} of {formatLeads(total)} left
        </span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-stone-400 dark:bg-stone-600"
          style={{ width: `${pct(completed)}%` }}
          title={`Completed: ${completed.toLocaleString()}`}
        />
        <div
          className="h-full bg-sky-400 dark:bg-sky-600"
          style={{ width: `${pct(inProgress)}%` }}
          title={`In progress: ${inProgress.toLocaleString()}`}
        />
        <div
          className="h-full bg-emerald-500"
          style={{ width: `${pct(notStarted)}%` }}
          title={`Not started: ${notStarted.toLocaleString()}`}
        />
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] tabular-nums text-muted-foreground">
        <span>
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-stone-400 dark:bg-stone-600" />
          {formatLeads(completed)} done
        </span>
        <span>
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-sky-400 dark:bg-sky-600" />
          {formatLeads(inProgress)} in progress
        </span>
        <span>
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {formatLeads(notStarted)} not started
        </span>
      </div>
    </div>
  )
}

function RunwayGauge({
  icon: Icon,
  label,
  days,
  leads,
  warningDays,
  criticalDays,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  days: number
  leads: number
  warningDays: number
  criticalDays: number
  /** Formula transparency, e.g. "40.5k emails ÷ 1,275/day" — every number
      should explain itself (Omar 2026-07-06). Falls back to lead count. */
  detail?: string
}) {
  // 999 is the "not tracked in sp_*" sentinel (e.g. lead-bank runway) —
  // render it honestly instead of as a healthy-looking 999-day gauge.
  const tracked = isFinite(days) && days < 999
  const d = tracked ? days : 0
  const colors = runwayColor(d, warningDays, criticalDays)
  const maxDays = Math.max(warningDays * 2, 30)
  const pct = Math.min((d / maxDays) * 100, 100)

  return (
    <div className="rounded-md bg-muted/50 px-2.5 py-2">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
      {tracked ? (
        <>
          <div className="flex items-baseline gap-1">
            <span className={cn("text-lg font-bold tabular-nums leading-none", colors.text)}>
              {d.toFixed(1)}
            </span>
            <span className="text-[10px] text-muted-foreground">days</span>
          </div>
          <div className="mt-1.5 h-1 w-full rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", colors.bg)}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
            {detail ?? `${formatLeads(leads)} leads`}
          </p>
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold leading-none text-muted-foreground">—</span>
          </div>
          <div className="mt-1.5 h-1 w-full rounded-full bg-muted" />
          <p className="mt-1 text-[10px] text-muted-foreground">Not tracked</p>
        </>
      )}
    </div>
  )
}
