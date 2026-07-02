"use client"

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
  Zap,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useSetupRealtime } from "@/hooks/use-setup-realtime"
import { toast } from "sonner"
import type { SetupStep, StepName, StepStatus } from "@/lib/types"

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

interface SetupDetailClientProps {
  setupId: number
  initialSteps: SetupStep[]
  hasFailedSteps: boolean
  canTriggerSmartlead: boolean
}

export function SetupDetailClient({
  setupId,
  initialSteps,
  hasFailedSteps,
  canTriggerSmartlead: initialCanTriggerSmartlead,
}: SetupDetailClientProps) {
  const { steps, loading } = useSetupRealtime(setupId)
  const activeStepRef = useRef<HTMLDivElement>(null)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [triggeringSmartlead, setTriggeringSmartlead] = useState(false)

  // Use realtime steps if available, otherwise fall back to SSR-provided initial steps
  const displaySteps = steps.length > 0 ? steps : initialSteps

  const completedCount = displaySteps.filter((s) => s.status === "completed").length
  const totalCount = displaySteps.length || 10
  const progressPct = Math.round((completedCount / totalCount) * 100)
  const currentFailedSteps = displaySteps.filter((s) => s.status === "failed")

  // Re-derive canTriggerSmartlead from live steps
  const mailboxStep = displaySteps.find((s) => s.step_name === "mailboxes_provisioned")
  const smartleadSeqStep = displaySteps.find((s) => s.step_name === "smartlead_sequencer_created")
  const canTriggerSmartlead =
    initialCanTriggerSmartlead ||
    (mailboxStep?.status === "completed" &&
      (smartleadSeqStep?.status === "pending" || smartleadSeqStep?.status === "failed"))

  // Auto-scroll to active step
  useEffect(() => {
    if (activeStepRef.current) {
      activeStepRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [displaySteps])

  async function handleRetry(stepName: StepName) {
    setRetrying(stepName)
    try {
      const res = await fetch("/api/onboarding/retry-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupId, stepName }),
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

  async function handleTriggerSmartlead() {
    setTriggeringSmartlead(true)
    try {
      const res = await fetch("/api/onboarding/trigger-smartlead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to trigger Smartlead phase")
        return
      }
      toast.success("Smartlead phase triggered successfully")
    } catch {
      toast.error("Network error — could not trigger Smartlead phase")
    } finally {
      setTriggeringSmartlead(false)
    }
  }

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
            className="h-full rounded-full bg-indigo-600 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Action buttons for failed/smartlead */}
      {(currentFailedSteps.length > 0 || canTriggerSmartlead) && (
        <div className="flex items-center gap-2 flex-wrap">
          {canTriggerSmartlead && (
            <Button
              size="sm"
              onClick={handleTriggerSmartlead}
              disabled={triggeringSmartlead}
            >
              {triggeringSmartlead ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              Trigger Smartlead Phase
            </Button>
          )}
          {currentFailedSteps.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {currentFailedSteps.length} step{currentFailedSteps.length !== 1 ? "s" : ""} failed — use retry buttons below
            </div>
          )}
        </div>
      )}

      {/* Vertical timeline */}
      <div className="relative">
        {displaySteps.map((step, idx) => {
          const config = STEP_CONFIG.find((c) => c.name === step.step_name)
          if (!config) return null

          const Icon = config.icon
          const isActive = step.status === "in_progress"
          const isCompleted = step.status === "completed"
          const isFailed = step.status === "failed"
          const isLast = idx === displaySteps.length - 1
          const canRetry = isFailed && RETRYABLE_STEPS.includes(step.step_name)
          const duration = formatDuration(step.started_at, step.completed_at)
          const hints = STEP_HINTS[step.step_name]
          const activeHint = isActive ? hints?.in_progress : isFailed ? hints?.failed : null

          return (
            <div
              key={step.id}
              ref={isActive ? activeStepRef : undefined}
              className="relative flex gap-4 pb-6 last:pb-0"
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
