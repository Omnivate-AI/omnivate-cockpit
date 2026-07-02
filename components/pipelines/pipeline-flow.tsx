"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { PipelineStep, PipelineRun } from "@/lib/queries/pipelines"
import { ChevronDown } from "lucide-react"

const ACTION_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  sql: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-300" },
  trigger_task: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300" },
  personalization_waterfall: { bg: "bg-purple-100 dark:bg-purple-900/40", text: "text-purple-700 dark:text-purple-300" },
  qa_with_a3_fix: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300" },
  upload_to_smartlead: { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300" },
  pre_upload_validation: { bg: "bg-sky-100 dark:bg-sky-900/40", text: "text-sky-700 dark:text-sky-300" },
}

function getActionColors(type: string) {
  return ACTION_TYPE_COLORS[type] ?? ACTION_TYPE_COLORS.sql
}

function formatActionType(type: string): string {
  return type.replace(/_/g, " ")
}

function getWaterfallLabel(taskId: string): string {
  if (taskId.includes("linkedin")) return "LinkedIn"
  if (taskId.includes("podcast")) return "Podcast"
  if (taskId.includes("fallback")) return "Fallback"
  const parts = taskId.split("-")
  const last = parts[parts.length - 1]
  return last.charAt(0).toUpperCase() + last.slice(1)
}

// --- Run status helpers ---

type StepRunStatus = "completed" | "failed" | "running" | "not_run"

const STEP_STATUS_STYLES: Record<StepRunStatus, { border: string; bg: string; dot: string }> = {
  completed: {
    border: "border-emerald-300 dark:border-emerald-700",
    bg: "bg-emerald-50/50 dark:bg-emerald-900/10",
    dot: "bg-emerald-500",
  },
  failed: {
    border: "border-rose-300 dark:border-rose-700",
    bg: "bg-rose-50/50 dark:bg-rose-900/10",
    dot: "bg-rose-500",
  },
  running: {
    border: "border-blue-300 dark:border-blue-700",
    bg: "bg-blue-50/50 dark:bg-blue-900/10",
    dot: "bg-blue-500",
  },
  not_run: {
    border: "border-border",
    bg: "bg-card",
    dot: "bg-gray-300 dark:bg-gray-600",
  },
}

interface StepRunInfo {
  status: StepRunStatus
  leadsProcessed?: number
}

function getStepRunInfo(
  step: PipelineStep,
  stepIndex: number,
  latestRun: PipelineRun | null
): StepRunInfo {
  if (!latestRun) return { status: "not_run" }

  const runStatus = latestRun.status
  const currentStepId = latestRun.current_step_id
  const stepsCompleted = latestRun.steps_completed

  // Parse step_results to find info about this step
  const stepResults = latestRun.step_results
  let leadsProcessed: number | undefined

  if (stepResults) {
    // step_results can be an object keyed by step name/id, or an array
    if (Array.isArray(stepResults)) {
      const entry = stepResults[stepIndex] as Record<string, unknown> | undefined
      if (entry) {
        leadsProcessed = (entry.leadsProcessed ?? entry.leads_processed) as number | undefined
      }
    } else {
      const byId = (stepResults as Record<string, Record<string, unknown>>)[step.id]
      const byName = (stepResults as Record<string, Record<string, unknown>>)[step.name]
      const entry = byId ?? byName
      if (entry) {
        leadsProcessed = (entry.leadsProcessed ?? entry.leads_processed) as number | undefined
      }
    }
  }

  // If the run is still running, determine which step is current
  if (runStatus === "running") {
    if (currentStepId === step.id) {
      return { status: "running", leadsProcessed }
    }
    // Steps before current are completed, after are not_run
    if (stepIndex < stepsCompleted) {
      return { status: "completed", leadsProcessed }
    }
    return { status: "not_run" }
  }

  // Run completed or failed
  if (runStatus === "completed") {
    // All steps completed
    return { status: "completed", leadsProcessed }
  }

  if (runStatus === "failed") {
    if (stepIndex < stepsCompleted) {
      return { status: "completed", leadsProcessed }
    }
    // The step that failed
    if (stepIndex === stepsCompleted) {
      return { status: "failed", leadsProcessed }
    }
    return { status: "not_run" }
  }

  // pending or other
  if (stepIndex < stepsCompleted) {
    return { status: "completed", leadsProcessed }
  }
  return { status: "not_run" }
}

// --- Step details ---

function StepDetails({ step }: { step: PipelineStep }) {
  const action = step.action
  if (!action) return null

  const actionType = action.type

  if (actionType === "trigger_task") {
    const taskId = action.taskId ?? step.task_id ?? "unknown"
    const payloadKeys = action.payload
      ? Object.keys(action.payload as Record<string, unknown>)
      : []
    return (
      <div className="mt-2 space-y-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Task ID:</span>
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{taskId}</code>
        </div>
        {payloadKeys.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground shrink-0">Payload:</span>
            <div className="flex flex-wrap gap-1">
              {payloadKeys.map((key) => (
                <code key={key} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                  {key}
                </code>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (actionType === "sql") {
    const statements: string[] = []
    if (action.sql) statements.push(String(action.sql))
    if (action.resetSql) statements.push(String(action.resetSql))
    if (action.statusSql) statements.push(String(action.statusSql))
    if (Array.isArray(action.statements)) {
      for (const s of action.statements) statements.push(String(s))
    }
    if (statements.length === 0) return null
    return (
      <div className="mt-2 space-y-1">
        {statements.map((sql, i) => (
          <pre
            key={i}
            className="rounded bg-gray-100 dark:bg-gray-800 p-2 text-[11px] font-mono text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap"
          >
            {sql}
          </pre>
        ))}
      </div>
    )
  }

  if (actionType === "personalization_waterfall" || action.waterfallSteps) {
    const waterfallSteps = action.waterfallSteps
    if (!waterfallSteps || waterfallSteps.length === 0) return null
    return (
      <div className="mt-2 space-y-1">
        <span className="text-xs text-muted-foreground">Sub-steps:</span>
        <ol className="list-decimal list-inside space-y-0.5 text-xs">
          {waterfallSteps.map((sub) => (
            <li key={sub.taskId} className="text-muted-foreground">
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                {sub.taskId}
              </code>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  const taskId = action.taskId ?? step.task_id
  const qualityGate = action.qualityGate as
    | { threshold?: number; field?: string }
    | undefined

  return (
    <div className="mt-2 space-y-1 text-xs">
      {taskId && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Task ID:</span>
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{taskId}</code>
        </div>
      )}
      {qualityGate && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Quality Gate:</span>
          <span>
            {qualityGate.field && (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] mr-1">
                {qualityGate.field}
              </code>
            )}
            {qualityGate.threshold != null && (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                ≥ {qualityGate.threshold}%
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  )
}

// --- Main component ---

interface PipelineFlowProps {
  steps: PipelineStep[]
  latestRun?: PipelineRun | null
  className?: string
}

export function PipelineFlow({ steps, latestRun, className }: PipelineFlowProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())

  if (steps.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No steps defined.</p>
  }

  function toggleStep(stepId: string) {
    setExpandedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(stepId)) {
        next.delete(stepId)
      } else {
        next.add(stepId)
      }
      return next
    })
  }

  return (
    <div className={cn("flex flex-col items-start", className)}>
      {steps.map((step, index) => {
        const actionType = step.action?.type ?? "sql"
        const colors = getActionColors(actionType)
        const waterfallSteps = step.action?.waterfallSteps
        const isExpanded = expandedSteps.has(step.id)
        const runInfo = getStepRunInfo(step, index, latestRun ?? null)
        const statusStyles = STEP_STATUS_STYLES[runInfo.status]

        return (
          <div key={step.id} className="w-full">
            {/* Arrow connector */}
            {index > 0 && (
              <div className="flex justify-center py-1">
                <div className="flex flex-col items-center">
                  <div className="h-4 w-px bg-border" />
                  <div className="h-0 w-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-border" />
                </div>
              </div>
            )}

            {/* Step card */}
            <button
              type="button"
              onClick={() => toggleStep(step.id)}
              className={cn(
                "w-full rounded-lg border p-3 text-left hover:bg-accent/50 transition-colors cursor-pointer",
                statusStyles.border,
                statusStyles.bg
              )}
            >
              <div className="flex items-center gap-2">
                {/* Status dot */}
                <div
                  className={cn(
                    "h-2.5 w-2.5 rounded-full shrink-0",
                    statusStyles.dot,
                    runInfo.status === "running" && "animate-pulse"
                  )}
                />
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200",
                    !isExpanded && "-rotate-90"
                  )}
                />
                <span className="font-medium text-sm">{step.name}</span>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                    colors.bg,
                    colors.text
                  )}
                >
                  {formatActionType(actionType)}
                </span>

                {/* Lead count badge */}
                {runInfo.leadsProcessed != null && runInfo.leadsProcessed > 0 && (
                  <span className="ml-auto text-[10px] tabular-nums text-muted-foreground font-medium">
                    {runInfo.leadsProcessed.toLocaleString()} leads
                  </span>
                )}
              </div>

              {/* Waterfall sub-steps (always visible) */}
              {!isExpanded && waterfallSteps && waterfallSteps.length > 0 && (
                <div className="mt-2 ml-8 flex items-center gap-1 text-xs text-muted-foreground">
                  {waterfallSteps.map((sub, i) => (
                    <span key={sub.taskId} className="flex items-center gap-1">
                      {i > 0 && <span className="text-muted-foreground/50">&rarr;</span>}
                      <span>{getWaterfallLabel(sub.taskId)}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Expanded details */}
              {isExpanded && (
                <div className="ml-8">
                  <StepDetails step={step} />
                </div>
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
