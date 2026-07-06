"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { TrendingUp, Shield, AlertTriangle, Pencil } from "lucide-react"
import { MailboxTargetsDialog } from "./mailbox-targets-dialog"
import type { ClientCapacityRow } from "@/lib/queries/mailboxes"

interface CapacityKPICardsProps {
  data: ClientCapacityRow
}

const CAPACITY_STYLES = {
  ok:      { border: "border-emerald-200 dark:border-emerald-900",  bg: "bg-emerald-50 dark:bg-emerald-950/40",  text: "text-emerald-700 dark:text-emerald-400",  badgeText: "On Target" },
  warning: { border: "border-amber-200 dark:border-amber-900",    bg: "bg-amber-50 dark:bg-amber-950/40",    text: "text-amber-700 dark:text-amber-400",    badgeText: "Near Target" },
  deficit: { border: "border-rose-300 dark:border-rose-900",     bg: "bg-rose-50 dark:bg-rose-950/40",     text: "text-rose-700 dark:text-rose-400",     badgeText: "Below Target" },
  unset:   { border: "border-dashed border-muted-foreground/30", bg: "bg-muted/20", text: "text-muted-foreground", badgeText: "Target Unset" },
} as const

const RESERVE_STYLES = {
  ok:        { border: "border-emerald-200 dark:border-emerald-900",  bg: "bg-emerald-50 dark:bg-emerald-950/40",  text: "text-emerald-700 dark:text-emerald-400",  badgeText: "Sufficient" },
  warning:   { border: "border-amber-200 dark:border-amber-900",    bg: "bg-amber-50 dark:bg-amber-950/40",    text: "text-amber-700 dark:text-amber-400",    badgeText: "Running Low" },
  emergency: { border: "border-rose-300 dark:border-rose-900",     bg: "bg-rose-50 dark:bg-rose-950/40",     text: "text-rose-700 dark:text-rose-400",     badgeText: "EMERGENCY" },
  unset:     { border: "border-dashed border-muted-foreground/30", bg: "bg-muted/20", text: "text-muted-foreground", badgeText: "Target Unset" },
} as const

export function CapacityKPICards({ data }: CapacityKPICardsProps) {
  const [editOpen, setEditOpen] = useState(false)
  const capacity = CAPACITY_STYLES[data.capacity_state]
  const reserve = RESERVE_STYLES[data.reserve_state]

  // Priority: boxes below threshold still in play (SWAP NOW) > burnt-domain
  // teardown backlog (CLEANUP) > all clear. The big number was previously
  // lifecycle='burnt' mailboxes, which reads 0 exactly when boxes are
  // burning in service (lifecycle only flips at rotation) — Omar 07-06.
  const burnActionBadge =
    data.at_risk_in_play > 0
      ? { border: "border-rose-300 dark:border-rose-900", bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-400", badgeText: `${data.at_risk_in_play} SWAP NOW` }
      : data.burnt_domain_count > 0
        ? { border: "border-amber-200 dark:border-amber-900", bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-400", badgeText: "CLEANUP" }
        : { border: "border-emerald-200 dark:border-emerald-900", bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-400", badgeText: "No Action" }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        {/* Card 1: Sending Capacity */}
        <Card className={cn("relative overflow-hidden border-2", capacity.border)}>
          <CardContent className={cn("px-4 py-4", capacity.bg)}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-1.5">
                <TrendingUp className={cn("h-4 w-4", capacity.text)} />
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Sending Capacity
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  capacity.bg,
                  capacity.text,
                  "ring-1 ring-current/10"
                )}
              >
                {capacity.badgeText}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={cn("text-3xl font-bold tabular-nums", capacity.text)}>
                {data.in_service_daily_capacity.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">emails/day (in service)</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {data.target_daily_volume !== null ? (
                <>
                  Target: {data.target_daily_volume.toLocaleString()}
                  {data.in_service_daily_capacity < data.target_daily_volume && (
                    <span className={cn("ml-2 font-medium", capacity.text)}>
                      (−{(data.target_daily_volume - data.in_service_daily_capacity).toLocaleString()})
                    </span>
                  )}
                </>
              ) : (
                <>No target set</>
              )}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {data.in_service_total} in service
              {data.in_service_burnt > 0 && (
                <span className="font-medium text-rose-700">
                  {" "}· {data.in_service_burnt} burnt (need swap)
                </span>
              )}
              {data.in_service_burnt === 0 && data.in_service_total > 0 && (
                <span className="text-emerald-700"> · all healthy</span>
              )}
            </div>
            {data.full_capacity > data.in_service_daily_capacity && (
              <div className="mt-1 text-xs text-muted-foreground">
                Full capacity: <span className="font-medium">{data.full_capacity.toLocaleString()}/day</span>
                <span className="text-muted-foreground"> (if all at 30/day)</span>
              </div>
            )}
            {data.persona_breakdown.length > 0 && data.persona_breakdown.some((p) => p.persona) && (
              <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                {data.persona_breakdown.map((p) => (
                  <div key={p.persona ?? "all"} className="flex items-center justify-between">
                    <span className="capitalize">{p.persona ?? "no persona"}</span>
                    <span className="tabular-nums">
                      {p.in_service_total} in service
                      {p.in_service_burnt > 0 && (
                        <span className="text-rose-700"> ({p.in_service_burnt} burnt)</span>
                      )}
                      {" · "}
                      {p.in_service_daily_capacity}/day
                    </span>
                  </div>
                ))}
              </div>
            )}
            {data.active_gap_mailboxes > 0 && data.reserves_to_deploy > 0 && (
              <div className="mt-1 text-xs font-medium text-amber-700">
                Deploy {data.reserves_to_deploy} reserve{data.reserves_to_deploy !== 1 ? "s" : ""} to fill active gap
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1 h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setEditOpen(true)}
              aria-label="Edit targets"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>

        {/* Card 2: Reserve Buffer */}
        <Card className={cn("relative overflow-hidden border-2", reserve.border)}>
          <CardContent className={cn("px-4 py-4", reserve.bg)}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-1.5">
                <Shield className={cn("h-4 w-4", reserve.text)} />
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Reserve Buffer
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  reserve.bg,
                  reserve.text,
                  "ring-1 ring-current/10"
                )}
              >
                {reserve.badgeText}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={cn("text-3xl font-bold tabular-nums", reserve.text)}>
                {data.reserve}
              </span>
              <span className="text-xs text-muted-foreground">healthy reserves</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {data.target_reserve_mailboxes !== null ? (
                <>
                  Target: {data.target_reserve_mailboxes} ({Math.round(data.buffer_pct * 100)}% buffer)
                  {data.reserve_deficit_count > 0 && (
                    <span className={cn("ml-2 font-medium", reserve.text)}>
                      (need {data.reserve_deficit_count} more)
                    </span>
                  )}
                </>
              ) : (
                <>No target set</>
              )}
            </div>
            {data.reserves_to_deploy > 0 && data.target_reserve_mailboxes !== null && (
              <div className="mt-1 text-xs text-muted-foreground">
                After deploying {data.reserves_to_deploy} to active: {data.reserves_remaining_after_deploy} remaining
              </div>
            )}
            {data.mailboxes_to_order > 0 && data.target_active_mailboxes !== null && (
              <div className="mt-1 text-xs font-medium text-rose-700">
                Order {data.mailboxes_to_order} new mailbox{data.mailboxes_to_order !== 1 ? "es" : ""} to restore buffer after rebalance
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Needs Action — leads with boxes burning while still in
            play (the emergency), then the teardown backlog (the cleanup) */}
        <Card className={cn("relative overflow-hidden border-2", burnActionBadge.border)}>
          <CardContent className={cn("px-4 py-4", burnActionBadge.bg)}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className={cn("h-4 w-4", burnActionBadge.text)} />
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Needs Action
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  burnActionBadge.bg,
                  burnActionBadge.text,
                  "ring-1 ring-current/10"
                )}
              >
                {burnActionBadge.badgeText}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={cn("text-3xl font-bold tabular-nums", burnActionBadge.text)}>
                {data.at_risk_in_play}
              </span>
              <span className="text-xs text-muted-foreground">
                boxes below 97% still in play
              </span>
            </div>
            {data.in_service_burnt > 0 && (
              <div className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-400">
                {data.in_service_burnt} in the live sending pool — swap in reserves
              </div>
            )}
            {data.burnt > 0 && (
              <div className="mt-1 text-xs text-muted-foreground">
                {data.burnt} marked burnt, awaiting rotation
              </div>
            )}
            <div className="mt-1 text-xs text-muted-foreground">
              {data.burnt_domain_count > 0
                ? `${data.burnt_domain_count} burnt domain${data.burnt_domain_count !== 1 ? "s" : ""} awaiting teardown`
                : "No burnt domains"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {data.draining > 0 && <>{data.draining} currently draining · </>}
              {data.retired > 0 && <>{data.retired} retired</>}
              {data.draining === 0 && data.retired === 0 && <>—</>}
            </div>
          </CardContent>
        </Card>
      </div>

      <MailboxTargetsDialog
        client={data.client}
        open={editOpen}
        onOpenChange={setEditOpen}
        initialTargetDailyVolume={data.target_daily_volume}
        initialBufferPct={data.buffer_pct}
      />
    </>
  )
}
