"use client"

import Link from "next/link"
import { ArrowRight, CheckCircle, XCircle, Upload, Zap } from "lucide-react"
import type { ClientSnapshot, DailyPoint } from "@/types/analytics"

interface ClientCardProps {
  snapshot: ClientSnapshot
  history: DailyPoint[]
}

export type HealthStatus = "critical" | "warning" | "healthy"

export function getHealthStatus(s: ClientSnapshot): HealthStatus {
  const urgentDays = Math.min(s.campaign_runway_days, s.pipeline_runway_days)
  if (urgentDays < s.runway_critical_days) return "critical"
  if (urgentDays < s.runway_warning_days) return "warning"
  return "healthy"
}

const STATUS_ORDER: Record<HealthStatus, number> = { critical: 0, warning: 1, healthy: 2 }

export function sortByHealth(a: ClientSnapshot, b: ClientSnapshot): number {
  const diff = STATUS_ORDER[getHealthStatus(a)] - STATUS_ORDER[getHealthStatus(b)]
  if (diff !== 0) return diff
  return a.display_name.localeCompare(b.display_name)
}

function StatusBadge({ status }: { status: HealthStatus }) {
  const styles = {
    critical: "bg-red-500/15 text-red-400",
    warning: "bg-amber-500/15 text-amber-400",
    healthy: "bg-emerald-500/15 text-emerald-400",
  }
  const labels = { critical: "Critical", warning: "Warning", healthy: "Healthy" }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles[status]}`}
    >
      {labels[status]}
    </span>
  )
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`
  return n.toLocaleString()
}

function getRunwayStatus(days: number, warningDays: number, criticalDays: number): HealthStatus {
  if (days < criticalDays) return "critical"
  if (days < warningDays) return "warning"
  return "healthy"
}

const RUNWAY_BAR_COLORS: Record<HealthStatus, string> = {
  critical: "bg-red-500",
  warning: "bg-amber-400",
  healthy: "bg-emerald-500",
}

const RUNWAY_TEXT_COLORS: Record<HealthStatus, string> = {
  critical: "text-red-600",
  warning: "text-amber-600",
  healthy: "text-gray-900",
}

const BORDER_COLORS: Record<HealthStatus, string> = {
  critical: "border-l-red-500",
  warning: "border-l-amber-500",
  healthy: "border-l-emerald-500",
}

/** A self-contained fuel gauge panel showing runway + lead count + action. */
function FuelGauge({
  label,
  days,
  warningDays,
  criticalDays,
  leadCount,
  leadLabel,
  subCount,
  subLabel,
  actionIcon: ActionIcon,
  actionLabel,
}: {
  label: string
  days: number
  warningDays: number
  criticalDays: number
  leadCount: number
  leadLabel: string
  subCount: number
  subLabel: string
  actionIcon: typeof Upload
  actionLabel: string
}) {
  const status = getRunwayStatus(days, warningDays, criticalDays)
  const maxDays = Math.max(warningDays * 2, 30)
  const pct = Math.min((days / maxDays) * 100, 100)
  const showAction = days < warningDays

  return (
    <div className="flex-1 rounded-lg bg-gray-50 px-3.5 py-3">
      {/* Panel label */}
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </p>

      {/* Runway days — hero number */}
      <div className="mt-1.5">
        <span className={`text-2xl font-bold tabular-nums leading-none ${RUNWAY_TEXT_COLORS[status]}`}>
          {days.toFixed(1)}
        </span>
        <span className="ml-0.5 text-xs font-normal text-gray-400">days</span>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full ${RUNWAY_BAR_COLORS[status]} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Lead count + context */}
      <div className="mt-2.5">
        <span className="text-sm font-semibold tabular-nums text-gray-900">
          {formatNumber(leadCount)}
        </span>
        <span className="ml-1 text-[11px] text-gray-500">{leadLabel}</span>
      </div>
      {subCount > 0 && (
        <p className="mt-0.5 text-[10px] text-gray-400">
          {formatNumber(subCount)} {subLabel}
        </p>
      )}

      {/* Action hint */}
      {showAction && (
        <div className="mt-2">
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${
            status === "critical" ? "text-red-500" : "text-amber-500"
          }`}>
            <ActionIcon className="h-2.5 w-2.5" />
            {actionLabel}
          </span>
        </div>
      )}
    </div>
  )
}

export function ClientCard({ snapshot, history }: ClientCardProps) {
  const s = snapshot
  const status = getHealthStatus(s)

  // Sends progress
  const sendsPct = s.daily_email_target > 0
    ? Math.min((s.emails_sent_count / s.daily_email_target) * 100, 100)
    : 0
  const sendsBarColour =
    sendsPct >= 100
      ? "bg-emerald-500"
      : sendsPct >= 50
        ? "bg-amber-500"
        : "bg-red-500"

  // Reply rate — lifetime figures
  const replyRate =
    s.all_time_emails_sent > 0 ? (s.all_time_interested / s.all_time_emails_sent) * 100 : 0

  return (
    <Link href={`/analytics/${s.client}`} className="group block">
      <div className={`relative overflow-hidden rounded-xl border border-gray-200 border-l-4 ${BORDER_COLORS[status]} bg-white p-5 transition-all duration-200 hover:border-gray-300 hover:shadow-md group-hover:-translate-y-0.5`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">{s.display_name}</h3>
          <StatusBadge status={status} />
        </div>

        {/* Two fuel gauge panels */}
        <div className="mt-3 flex gap-2.5">
          <FuelGauge
            label="In Campaigns"
            days={s.campaign_runway_days}
            warningDays={s.runway_warning_days}
            criticalDays={s.runway_critical_days}
            leadCount={s.leads_not_started}
            leadLabel="queued"
            subCount={s.leads_in_progress}
            subLabel="sending"
            actionIcon={Upload}
            actionLabel="Upload leads"
          />
          <FuelGauge
            label="Ready to Upload"
            days={s.pipeline_runway_days}
            warningDays={s.runway_warning_days}
            criticalDays={s.runway_critical_days}
            leadCount={s.ready_leads}
            leadLabel="leads"
            subCount={s.qualified_no_email}
            subLabel="need email"
            actionIcon={Zap}
            actionLabel="Run enrichment"
          />
        </div>

        {/* Sends yesterday */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="tabular-nums text-gray-500">{formatNumber(s.emails_sent_count)}</span>
            <div className="flex items-center gap-1.5">
              {s.hitting_target ? (
                <CheckCircle className="h-3 w-3 text-emerald-500" />
              ) : (
                <XCircle className="h-3 w-3 text-red-400" />
              )}
              <span className="tabular-nums text-gray-400">{formatNumber(s.daily_email_target)}</span>
            </div>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full ${sendsBarColour} transition-all duration-500`}
              style={{ width: `${sendsPct}%` }}
            />
          </div>
        </div>

        {/* Footer: reply rate + link */}
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
          <div>
            <span className="text-lg font-bold text-gray-900">{replyRate.toFixed(1)}%</span>
            <span className="ml-1.5 text-[10px] text-gray-400">reply rate</span>
          </div>
          <span className="flex items-center gap-1 text-xs text-gray-400 transition-colors group-hover:text-gray-600">
            View detail
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </Link>
  )
}
