"use client"

import Link from "next/link"
import {
  Plus,
  Globe,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  Rocket,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { SetupListItem } from "@/lib/queries"
import type { SetupStatus } from "@/lib/types"

const STATUS_CONFIG: Record<
  SetupStatus,
  { label: string; color: string; bgColor: string; icon: typeof Clock }
> = {
  draft: {
    label: "Draft",
    color: "text-stone-600 dark:text-stone-400",
    bgColor: "bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700",
    icon: Clock,
  },
  configuring: {
    label: "Configuring",
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800",
    icon: Loader2,
  },
  purchasing: {
    label: "Purchasing",
    color: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800",
    icon: Loader2,
  },
  provisioning: {
    label: "Provisioning",
    color: "text-sky-700 dark:text-sky-300",
    bgColor: "bg-sky-50 dark:bg-sky-950 border-sky-200 dark:border-sky-800",
    icon: Rocket,
  },
  smartlead_pending: {
    label: "Smartlead Pending",
    color: "text-violet-700 dark:text-violet-300",
    bgColor: "bg-violet-50 dark:bg-violet-950 border-violet-200 dark:border-violet-800",
    icon: Loader2,
  },
  completed: {
    label: "Completed",
    color: "text-emerald-700 dark:text-emerald-300",
    bgColor: "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    color: "text-red-700 dark:text-red-300",
    bgColor: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
    icon: XCircle,
  },
}

function getSetupHref(setup: SetupListItem): string {
  switch (setup.status) {
    case "draft":
    case "configuring":
      // Resume wizard at appropriate step
      return `/onboarding?step=client-info&setupId=${setup.id}`
    case "purchasing":
    case "provisioning":
    case "smartlead_pending":
      return `/onboarding?step=provisioning&setupId=${setup.id}`
    case "completed":
      return `/clients/${setup.client_slug}`
    case "failed":
      return `/onboarding?step=provisioning&setupId=${setup.id}`
    default:
      return `/onboarding?step=client-info&setupId=${setup.id}`
  }
}

function getActionLabel(status: SetupStatus): string {
  switch (status) {
    case "draft":
    case "configuring":
      return "Resume Setup"
    case "purchasing":
    case "provisioning":
    case "smartlead_pending":
      return "View Status"
    case "completed":
      return "View Client"
    case "failed":
      return "View Details"
    default:
      return "Open"
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

interface OnboardingListProps {
  setups: SetupListItem[]
}

export function OnboardingList({ setups }: OnboardingListProps) {
  // Empty state
  if (setups.length === 0) {
    return (
      <>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Client Onboarding
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage client setups — domains, mailboxes, and Smartlead
              integration
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-200 dark:border-stone-700 py-20">
          <Rocket className="h-12 w-12 text-stone-300 dark:text-stone-600 mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-1">
            No setups yet
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Set up your first client with domains, mailboxes, and Smartlead.
          </p>
          <Button asChild>
            <Link href="/onboarding?step=client-info">
              <Plus className="mr-2 h-4 w-4" />
              Set Up Your First Client
            </Link>
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Client Onboarding
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage client setups — domains, mailboxes, and Smartlead integration
          </p>
        </div>
        <Button asChild>
          <Link href="/onboarding?step=client-info">
            <Plus className="mr-2 h-4 w-4" />
            Start New Setup
          </Link>
        </Button>
      </div>

      {/* Setup cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {setups.map((setup) => {
          const config = STATUS_CONFIG[setup.status]
          const StatusIcon = config.icon
          const progressPct =
            setup.total_steps > 0
              ? Math.round((setup.completed_steps / setup.total_steps) * 100)
              : 0
          const href = getSetupHref(setup)
          const actionLabel = getActionLabel(setup.status)

          return (
            <Link
              key={setup.id}
              href={href}
              className="group rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 space-y-4 transition-all duration-150 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              {/* Top: name + status badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground truncate">
                    {setup.display_name}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    {setup.client_slug}
                  </p>
                </div>
                <Badge
                  className={cn(
                    "shrink-0 text-[10px] px-2 py-0.5 border",
                    config.bgColor,
                    config.color
                  )}
                >
                  <StatusIcon
                    className={cn(
                      "mr-1 h-3 w-3",
                      (setup.status === "configuring" ||
                        setup.status === "purchasing" ||
                        setup.status === "smartlead_pending") &&
                        "animate-spin"
                    )}
                  />
                  {config.label}
                </Badge>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {setup.domain_count != null && setup.domain_count > 0 && (
                  <span className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    {setup.domain_count} domain
                    {setup.domain_count !== 1 ? "s" : ""}
                  </span>
                )}
                {setup.total_mailboxes != null && setup.total_mailboxes > 0 && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {setup.total_mailboxes} mailbox
                    {setup.total_mailboxes !== 1 ? "es" : ""}
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {setup.completed_steps}/{setup.total_steps} steps
                  </span>
                  <span className="text-muted-foreground">{progressPct}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      setup.status === "completed"
                        ? "bg-emerald-500"
                        : setup.status === "failed"
                          ? "bg-red-500"
                          : "bg-indigo-500"
                    )}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Footer: dates + action */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-muted-foreground">
                  {setup.completed_at
                    ? `Completed ${formatDate(setup.completed_at)}`
                    : `Created ${formatDate(setup.created_at)}`}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  {actionLabel}
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}
