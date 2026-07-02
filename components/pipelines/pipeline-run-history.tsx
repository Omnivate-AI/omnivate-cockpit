"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ChevronRight, ChevronDown, Clock, AlertCircle } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import type { PipelineRun } from "@/lib/queries/pipelines"

interface StepResult {
  stepId?: string
  stepName?: string
  name?: string
  status?: string
  duration?: number
  leadsProcessed?: number
  leads_processed?: number
  error?: string
  [key: string]: unknown
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  running: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  failed: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  pending: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
        STATUS_BADGE_STYLES[status] ?? STATUS_BADGE_STYLES.pending
      )}
    >
      {status}
    </span>
  )
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return "—"
  const start = new Date(startedAt).getTime()
  const end = completedAt ? new Date(completedAt).getTime() : Date.now()
  const diffMs = end - start
  if (diffMs < 0) return "—"

  const totalSeconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

function formatStepDuration(durationMs: number | undefined): string {
  if (!durationMs && durationMs !== 0) return "—"
  const totalSeconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function parseStepResults(stepResults: unknown): StepResult[] {
  if (!stepResults) return []
  if (Array.isArray(stepResults)) return stepResults as StepResult[]
  if (typeof stepResults === "object") {
    return Object.entries(stepResults as Record<string, unknown>).map(
      ([key, val]) => ({
        stepName: key,
        ...(typeof val === "object" && val !== null ? (val as StepResult) : {}),
      })
    )
  }
  return []
}

interface PipelineRunHistoryProps {
  runs: PipelineRun[]
}

export function PipelineRunHistory({ runs }: PipelineRunHistoryProps) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)

  if (runs.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="No Runs Yet"
        description="No pipeline runs have been recorded."
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="w-8 pb-2" />
            <th className="pb-2 font-medium">Batch ID</th>
            <th className="pb-2 font-medium">Status</th>
            <th className="pb-2 font-medium">Steps</th>
            <th className="pb-2 font-medium">Started</th>
            <th className="pb-2 font-medium">Duration</th>
            <th className="pb-2 font-medium">Error</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const isExpanded = expandedRunId === run.id
            const stepResults = parseStepResults(run.step_results)

            return (
              <RunRow
                key={run.id}
                run={run}
                isExpanded={isExpanded}
                stepResults={stepResults}
                onToggle={() =>
                  setExpandedRunId(isExpanded ? null : run.id)
                }
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function RunRow({
  run,
  isExpanded,
  stepResults,
  onToggle,
}: {
  run: PipelineRun
  isExpanded: boolean
  stepResults: StepResult[]
  onToggle: () => void
}) {
  const Chevron = isExpanded ? ChevronDown : ChevronRight

  return (
    <>
      <tr
        className="border-b cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <td className="py-2 pr-1">
          <Chevron className="h-4 w-4 text-muted-foreground" />
        </td>
        <td className="py-2 font-mono text-xs">
          {run.batch_id ?? "—"}
        </td>
        <td className="py-2">
          <StatusBadge status={run.status} />
        </td>
        <td className="py-2 tabular-nums">
          {run.steps_completed}/{run.steps_total}
        </td>
        <td className="py-2 text-muted-foreground">
          {run.started_at ? timeAgo(run.started_at) : "—"}
        </td>
        <td className="py-2 tabular-nums">
          {formatDuration(run.started_at, run.completed_at)}
        </td>
        <td className="py-2 max-w-[200px]">
          {run.error && (
            <span className="text-rose-600 dark:text-rose-400 text-xs truncate block" title={run.error}>
              {run.error.length > 60 ? run.error.slice(0, 60) + "…" : run.error}
            </span>
          )}
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={7} className="bg-muted/30 px-4 py-3">
            {run.error && run.status === "failed" && (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 dark:border-rose-800 dark:bg-rose-900/20">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <p className="text-xs text-rose-700 dark:text-rose-300 break-all">
                  {run.error}
                </p>
              </div>
            )}

            {stepResults.length > 0 ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-1.5 font-medium">Step</th>
                    <th className="pb-1.5 font-medium">Status</th>
                    <th className="pb-1.5 font-medium">Duration</th>
                    <th className="pb-1.5 font-medium">Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {stepResults.map((step, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1.5">{step.stepName ?? step.name ?? `Step ${i + 1}`}</td>
                      <td className="py-1.5">
                        {step.status ? <StatusBadge status={step.status} /> : "—"}
                      </td>
                      <td className="py-1.5 tabular-nums">
                        {formatStepDuration(step.duration)}
                      </td>
                      <td className="py-1.5 tabular-nums">
                        {step.leadsProcessed ?? step.leads_processed ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-muted-foreground">No step details available.</p>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
