import {
  getClientPipelines,
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
import { RunPipelineButton } from "@/components/pipelines/run-pipeline-button"
import { PromptLibraryViewer } from "@/components/pipelines/prompt-library-viewer"
import { PipelineRunHistory } from "@/components/pipelines/pipeline-run-history"
import { EmptyState } from "@/components/shared/empty-state"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Workflow } from "lucide-react"
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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">{pipeline.name}</CardTitle>
            <p className="text-xs text-muted-foreground font-mono">{pipeline.table_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <RunPipelineButton
              pipelineId={pipeline.id}
              client={pipeline.client}
              pipelineName={pipeline.name}
            />
            <Badge
              variant="outline"
              className={cn(
                pipeline.is_active
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
                  : "border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
              )}
            >
              {pipeline.is_active ? "Active" : "Inactive"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {pipeline.steps.length} step{pipeline.steps.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {latestRun && (
          <div className="pt-2">
            <LatestRunInfo run={latestRun} />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
    </Card>
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
  const pipelines = await getClientPipelines(clientSlug)

  if (pipelines.length === 0) {
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

  return (
    <div className="space-y-6">
      {pipelines.map((pipeline, index) => (
        <PipelineCard
          key={pipeline.id}
          pipeline={pipeline}
          latestRun={latestRuns[index]}
          prompts={promptSets[index]}
          runs={runHistories[index]}
        />
      ))}
    </div>
  )
}
