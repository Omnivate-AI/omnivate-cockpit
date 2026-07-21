import { ChevronRight, GitBranch } from "lucide-react"
import { cn } from "@/lib/utils"
import { layoutDagLevels, dependencyNames } from "@/lib/dag-layout"
import type { EngineCampaign, EngineCampaignStep } from "@/lib/queries/pipelines"

/**
 * V4 D1/D2 — one Pipeline-Engine campaign as a COLLAPSIBLE card (native
 * <details>, zero JS) whose body draws the true DAG: dependency levels flow
 * downward, steps within a level sit side-by-side ("sometimes things happen
 * in parallel" — Omar). Inactive steps stay visible but greyed — they are
 * part of the build's true shape.
 */

const STATUS_STYLES: Record<string, string> = {
  active:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400",
  draft:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400",
  paused:
    "border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400",
}

const STEP_TYPE_STYLES: Record<string, string> = {
  ai: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  sql: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  scrape: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  vector_match: "bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300",
  task: "bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
}

function StatusBadge({ status }: { status: string | null }) {
  const key = (status ?? "draft").toLowerCase()
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize",
        STATUS_STYLES[key] ?? STATUS_STYLES.paused
      )}
    >
      {key}
    </span>
  )
}

function StepNode({
  step,
  allSteps,
}: {
  step: EngineCampaignStep
  allSteps: EngineCampaignStep[]
}) {
  const after = dependencyNames(step, allSteps)
  const typeKey = (step.step_type ?? "task").toLowerCase()
  return (
    <div
      className={cn(
        "min-w-[160px] max-w-[240px] flex-1 rounded-md border px-3 py-2",
        step.is_active ? "bg-card" : "border-dashed bg-muted/40 opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium leading-snug">{step.name}</span>
        {!step.is_active && (
          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
            off
          </span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium",
            STEP_TYPE_STYLES[typeKey] ?? "bg-muted text-muted-foreground"
          )}
        >
          {typeKey}
        </span>
        {step.has_condition && (
          <span
            className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
            title="Runs only when its condition matches"
          >
            conditional
          </span>
        )}
      </div>
      {after.length > 0 && (
        <p
          className="mt-1 truncate text-[9px] text-muted-foreground"
          title={`Waits for: ${after.join(", ")}`}
        >
          after: {after.join(", ")}
        </p>
      )}
    </div>
  )
}

export function EngineDagFlow({ steps }: { steps: EngineCampaignStep[] }) {
  const bands = layoutDagLevels(steps)
  if (bands.length === 0) {
    return <p className="text-sm text-muted-foreground">No steps defined.</p>
  }
  return (
    <div className="space-y-0">
      {bands.map((band, i) => (
        <div key={i}>
          {i > 0 && (
            <div className="flex justify-center py-1 text-muted-foreground" aria-hidden>
              ↓
            </div>
          )}
          <div
            className={cn(
              "flex flex-wrap gap-2",
              band.length > 1 && "rounded-lg border border-dashed p-2"
            )}
          >
            {band.map((s) => (
              <StepNode key={s.id} step={s} allSteps={steps} />
            ))}
            {band.length > 1 && (
              <span className="w-full text-right text-[9px] uppercase tracking-wide text-muted-foreground">
                {band.length} steps — run in parallel
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export function EngineCampaignCard({ campaign }: { campaign: EngineCampaign }) {
  const activeSteps = campaign.steps.filter((s) => s.is_active).length
  return (
    // Collapsed by default (V4 D1 — "so we don't have these massive cards").
    <details className="group rounded-lg border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
        <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium">{campaign.name}</span>
          {campaign.lead_table && (
            <span className="ml-2 hidden font-mono text-xs text-muted-foreground sm:inline">
              {campaign.lead_table}
            </span>
          )}
        </div>
        <StatusBadge status={campaign.status} />
        {campaign.engine_version && (
          <span className="hidden shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
            engine {campaign.engine_version}
          </span>
        )}
        <span className="shrink-0 text-xs text-muted-foreground">
          {activeSteps}/{campaign.steps.length} steps
        </span>
      </summary>
      <div className="space-y-3 border-t px-4 py-4">
        {campaign.description && (
          <p className="text-xs text-muted-foreground">{campaign.description}</p>
        )}
        <EngineDagFlow steps={campaign.steps} />
      </div>
    </details>
  )
}
