"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import {
  Briefcase,
  Globe,
  Wifi,
  Mail,
  ArrowRightLeft,
  Image,
  Server,
  Upload,
  Tag,
  RefreshCw,
  Check,
  X,
  Loader2,
  Clock,
  RotateCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useSetupRealtime } from "@/hooks/use-setup-realtime"
import { toast } from "sonner"
import type { StepName, StepStatus } from "@/lib/types"

const STEP_CONFIG: {
  name: StepName
  label: string
  icon: typeof Briefcase
}[] = [
  { name: "workspace_created", label: "Workspace Created", icon: Briefcase },
  { name: "domains_purchased", label: "Domains Purchased", icon: Globe },
  { name: "dns_propagated", label: "DNS Propagation", icon: Wifi },
  { name: "mailboxes_provisioned", label: "Mailboxes Provisioned", icon: Mail },
  { name: "catch_all_configured", label: "Catch-All Configured", icon: ArrowRightLeft },
  { name: "profile_pictures_set", label: "Profile Pictures Set", icon: Image },
  { name: "smartlead_sequencer_created", label: "Smartlead Sequencer Created", icon: Server },
  { name: "smartlead_exported", label: "Smartlead Export", icon: Upload },
  { name: "smartlead_tagged", label: "Smartlead Tagged", icon: Tag },
  { name: "inventory_synced", label: "Inventory Synced", icon: RefreshCw },
]

const RETRYABLE_STEPS: StepName[] = [
  "domains_purchased",
  "dns_propagated",
  "mailboxes_provisioned",
  "smartlead_exported",
]

const STEP_HINTS: Partial<Record<StepName, { in_progress?: string; failed?: string }>> = {
  dns_propagated: {
    in_progress: "DNS propagation typically takes 1\u20136 hours. The system checks every 15 minutes.",
    failed: "DNS propagation expired. Use Retry to regenerate nameservers and restart polling.",
  },
  mailboxes_provisioned: {
    in_progress: "Mailboxes are being provisioned. This usually completes shortly after DNS propagation.",
    failed: "Check InboxKit for the specific failure reason. Retry will attempt to re-provision failed mailboxes.",
  },
  smartlead_exported: {
    in_progress: "Exporting mailboxes to Smartlead. If this takes longer than 30 minutes, the system will attempt a direct API fallback.",
    failed: "Smartlead export failed or timed out. Retry to attempt the export again.",
  },
  domains_purchased: {
    failed: "Some domains may have failed to register. Retry to re-trigger the provisioning task.",
  },
}

function formatDuration(startedAt: string | null, completedAt: string | null): string | null {
  if (!startedAt || !completedAt) return null
  const start = new Date(startedAt).getTime()
  const end = new Date(completedAt).getTime()
  const diffMs = end - start
  if (diffMs < 1000) return "<1s"
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSec = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSec}s`
  const hours = Math.floor(minutes / 60)
  const remainingMin = minutes % 60
  return `${hours}h ${remainingMin}m`
}

function StepStatusBadge({ status }: { status: StepStatus }) {
  switch (status) {
    case "pending":
      return (
        <Badge className="bg-stone-100 text-stone-500 border-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:border-stone-700">
          <Clock className="mr-1 h-3 w-3" />
          Pending
        </Badge>
      )
    case "in_progress":
      return (
        <Badge className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          In Progress
        </Badge>
      )
    case "completed":
      return (
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
          <Check className="mr-1 h-3 w-3" />
          Completed
        </Badge>
      )
    case "failed":
      return (
        <Badge className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800">
          <X className="mr-1 h-3 w-3" />
          Failed
        </Badge>
      )
    case "skipped":
      return (
        <Badge className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
          Skipped
        </Badge>
      )
    default:
      return null
  }
}

export function ProvisioningStep() {
  const searchParams = useSearchParams()
  const setupId = searchParams.get("setupId")
  const numericSetupId = setupId ? Number(setupId) : null

  const { steps, loading } = useSetupRealtime(numericSetupId)
  const activeStepRef = useRef<HTMLDivElement>(null)
  const [retrying, setRetrying] = useState<string | null>(null)

  // Auto-scroll to active step
  useEffect(() => {
    if (activeStepRef.current) {
      activeStepRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [steps])

  const completedCount = steps.filter((s) => s.status === "completed").length
  const totalCount = steps.length || 10
  const progressPct = Math.round((completedCount / totalCount) * 100)

  async function handleRetry(stepName: StepName) {
    if (!numericSetupId) return
    setRetrying(stepName)

    try {
      const res = await fetch("/api/onboarding/retry-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupId: numericSetupId, stepName }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Retry failed")
        return
      }

      toast.success(`Retrying ${stepName.replace(/_/g, " ")}...`)
    } catch {
      toast.error("Network error — could not retry")
    } finally {
      setRetrying(null)
    }
  }

  if (!numericSetupId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground">
          No setup in progress. Complete the previous steps first.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-4 w-full rounded-full bg-stone-100 dark:bg-stone-800 animate-pulse" />
        <div className="space-y-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-stone-100 dark:bg-stone-800 animate-pulse" />
              <div className="h-4 w-48 rounded bg-stone-100 dark:bg-stone-800 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Find active step index for auto-scroll
  const activeIndex = steps.findIndex((s) => s.status === "in_progress")

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            {completedCount}/{totalCount} steps complete
          </span>
          <span className="text-muted-foreground">{progressPct}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
          <div
            className={cn(
              "h-full rounded-full bg-indigo-600 transition-all duration-700 ease-out",
              progressPct > 0 && progressPct < 100 && "animate-pulse"
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Vertical timeline */}
      <div className="relative">
        {steps.map((step, idx) => {
          const config = STEP_CONFIG.find((c) => c.name === step.step_name)
          if (!config) return null

          const Icon = config.icon
          const isActive = step.status === "in_progress"
          const isCompleted = step.status === "completed"
          const isFailed = step.status === "failed"
          const isLast = idx === steps.length - 1
          const canRetry = isFailed && RETRYABLE_STEPS.includes(step.step_name)
          const duration = formatDuration(step.started_at, step.completed_at)
          const hints = STEP_HINTS[step.step_name]
          const activeHint = isActive ? hints?.in_progress : isFailed ? hints?.failed : null

          return (
            <div
              key={step.id}
              ref={isActive ? activeStepRef : undefined}
              className="relative flex gap-4 pb-6 last:pb-0 animate-in fade-in slide-in-from-left-2 duration-300"
              style={{ animationDelay: `${idx * 50}ms`, animationFillMode: "backwards" }}
            >
              {/* Vertical line connector */}
              {!isLast && (
                <div
                  className={cn(
                    "absolute left-5 top-10 w-0.5 bottom-0",
                    isCompleted
                      ? "bg-emerald-300 dark:bg-emerald-700"
                      : "bg-stone-200 dark:bg-stone-700"
                  )}
                />
              )}

              {/* Step circle */}
              <div
                className={cn(
                  "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
                  isCompleted && "border-emerald-500 bg-emerald-500 text-white",
                  isActive && "border-blue-500 bg-blue-500 text-white ring-4 ring-blue-100 dark:ring-blue-950",
                  isFailed && "border-red-500 bg-red-500 text-white",
                  step.status === "pending" && "border-stone-300 bg-white text-stone-400 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-500",
                  step.status === "skipped" && "border-amber-400 bg-amber-50 text-amber-500 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-400"
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : isFailed ? (
                  <X className="h-5 w-5" />
                ) : isActive ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    className={cn(
                      "font-medium text-sm",
                      isCompleted && "text-foreground",
                      isActive && "text-blue-700 dark:text-blue-300",
                      isFailed && "text-red-700 dark:text-red-300",
                      step.status === "pending" && "text-muted-foreground",
                      step.status === "skipped" && "text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {config.label}
                  </span>
                  <StepStatusBadge status={step.status} />
                  {duration && (
                    <span className="text-xs text-muted-foreground">{duration}</span>
                  )}
                </div>

                {/* Error message */}
                {isFailed && step.error_message && (
                  <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 rounded-md px-3 py-2 border border-red-100 dark:border-red-900">
                    {step.error_message}
                  </p>
                )}

                {/* Contextual hint */}
                {activeHint && (
                  <p className={cn(
                    "mt-1.5 text-xs rounded-md px-3 py-2 border",
                    isActive
                      ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-100 dark:border-blue-900"
                      : "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-100 dark:border-amber-900"
                  )}>
                    {activeHint}
                  </p>
                )}

                {/* Retry button */}
                {canRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs"
                    disabled={retrying === step.step_name}
                    onClick={() => handleRetry(step.step_name)}
                  >
                    {retrying === step.step_name ? (
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCw className="mr-1.5 h-3 w-3" />
                    )}
                    Retry
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
