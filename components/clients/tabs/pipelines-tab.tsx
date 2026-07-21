import {
  getClientPipelines,
  getClientEngineCampaigns,
  getLatestPipelineRun,
  getPipelineRuns,
  getCampaignPrompts,
} from "@/lib/queries/pipelines"
import type {
  PipelineDefinition,
  PipelineRun,
  GroupedCampaignPrompts,
} from "@/lib/queries/pipelines"
import { PipelineFlow } from "@/components/pipelines/pipeline-flow"
import { EngineCampaignCard } from "@/components/pipelines/engine-campaign-card"
import { RunPipelineButton } from "@/components/pipelines/run-pipeline-button"
import { PromptLibraryViewer } from "@/components/pipelines/prompt-library-viewer"
import { PipelineRunHistory } from "@/components/pipelines/pipeline-run-history"
import { EmptyState } from "@/components/shared/empty-state"
import { SectionFreshness } from "@/components/shared/section-freshness"
import { Badge } from "@/components/ui/badge"
import { ChevronRight, Workflow } from "lucide-react"
import { cn } from "@/lib/utils"

interface PipelinesTabProps {
  clientSlug: string
}

const RUN_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  completed: { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300" },
  running: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300" },
  pending: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300" },
  failed: { bg: "bg-rose-100 dark:bg-rose-900/40", text: "text-rose-700 dark:text-rose-300" },
}

function RunStatusBadge({ status }: { status: string }) {
  const styles = RUN_STATUS_STYLES[status] ?? RUN_STATUS_STYLES.pending
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        styles.bg,
        styles.text
      )}
    >
      {status}
    </span>
  )
}

function LatestRunInfo({ run }: { run: PipelineRun }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <RunStatusBadge status={run.status} />
      {run.batch_id && <span className="font-mono">{run.batch_id}</span>}
      <span>
        {run.steps_completed}/{run.steps_total} steps
      </span>
    </div>
  )
}

/**
 * V4 D1 — every pipeline card is a COLLAPSIBLE (native <details>), collapsed
 * by default with a one-line summary, so the tab opens compact instead of a
 * wall of massive cards. Legacy pipeline_definitions steps carry no dependency
 * data — they are genuinely sequential monoliths, so their body keeps the
 * sequential PipelineFlow (that IS their true shape); the engine campaigns
 * above render the real DAG.
 */
function PipelineCard({
  pipeline,
  latestRun,
  prompts,
  runs,
}: {
  pipeline: PipelineDefinition
  latestRun: PipelineRun | null
  prompts: GroupedCampaignPrompts | null
  runs: PipelineRun[]
}) {
  return (
    <details className="group rounded-lg border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium">{pipeline.name}</span>
          <span className="ml-2 hidden font-mono text-xs text-muted-foreground sm:inline">
            {pipeline.table_name}
          </span>
        </div>
        {latestRun && <RunStatusBadge status={latestRun.status} />}
        <Badge
          variant="outline"
          className={cn(
            "shrink-0",
            pipeline.is_active
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
              : "border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
          )}
        >
          {pipeline.is_active ? "Active" : "Inactive"}
        </Badge>
        <span className="shrink-0 text-xs text-muted-foreground">
          {pipeline.steps.length} step{pipeline.steps.length !== 1 ? "s" : ""}
        </span>
      </summary>

      <div className="space-y-4 border-t px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          {latestRun ? <LatestRunInfo run={latestRun} /> : <span />}
          <RunPipelineButton
            pipelineId={pipeline.id}
            client={pipeline.client}
            pipelineName={pipeline.name}
          />
        </div>
        <PipelineFlow steps={pipeline.steps} latestRun={latestRun} />
        {prompts && Object.keys(prompts).length > 0 && (
          <div className="border-t pt-4">
            <PromptLibraryViewer groupedPrompts={prompts} />
          </div>
        )}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3">Run History</h4>
          <PipelineRunHistory runs={runs} />
        </div>
      </div>
    </details>
  )
}

function getCampaignIdFromPipeline(pipeline: PipelineDefinition): number | null {
  const settings = pipeline.settings
  if (!settings) return null
  // Check common field names for campaign ID in settings
  const id = settings.campaignId ?? settings.campaign_id ?? settings.smartlead_campaign_id
  return typeof id === "number" ? id : null
}

export async function PipelinesTab({ clientSlug }: PipelinesTabProps) {
  const [pipelines, engineCampaigns] = await Promise.all([
    getClientPipelines(clientSlug),
    getClientEngineCampaigns(clientSlug),
  ])

  if (pipelines.length === 0 && engineCampaigns.length === 0) {
    return (
      <EmptyState
        icon={Workflow}
        title="No Pipelines"
        description="No pipeline definitions found for this client."
      />
    )
  }

  // Fetch latest run, full run history, and prompts for each pipeline in parallel
  const [latestRuns, runHistories, promptSets] = await Promise.all([
    Promise.all(pipelines.map((p) => getLatestPipelineRun(p.id))),
    Promise.all(pipelines.map((p) => getPipelineRuns(p.id, 10))),
    Promise.all(
      pipelines.map((p) => {
        const campaignId = getCampaignIdFromPipeline(p)
        return campaignId ? getCampaignPrompts(campaignId) : Promise.resolve(null)
      })
    ),
  ])

  // Active engine campaigns first (they're what's running), drafts after.
  const engineSorted = [...engineCampaigns].sort((a, b) => {
    const rank = (s: string | null) => (s === "active" ? 0 : s === "draft" ? 1 : 2)
    return rank(a.status) - rank(b.status)
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <SectionFreshness mode="db" prefix="Live pipeline state" />
      </div>

      {/* Engine campaigns (the `campaigns` registry — v2/v3 DAG builds) */}
      {engineSorted.length > 0 && (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Campaign Pipelines</h3>
            <p className="text-xs text-muted-foreground">
              Pipeline-Engine campaigns — expand a card to see the true flow:
              steps side-by-side run in parallel, arrows mark dependencies.
            </p>
          </div>
          {engineSorted.map((c) => (
            <EngineCampaignCard key={c.id} campaign={c} />
          ))}
        </section>
      )}

      {/* Legacy pipeline_definitions (sequential monoliths — their true shape) */}
      {pipelines.length > 0 && (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Legacy Pipelines</h3>
            <p className="text-xs text-muted-foreground">
              Pre-engine pipelines — strictly sequential by design.
            </p>
          </div>
          {pipelines.map((pipeline, index) => (
            <PipelineCard
              key={pipeline.id}
              pipeline={pipeline}
              latestRun={latestRuns[index]}
              prompts={promptSets[index]}
              runs={runHistories[index]}
            />
          ))}
        </section>
      )}
    </div>
  )
}
