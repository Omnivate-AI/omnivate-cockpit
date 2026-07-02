import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"

// --- Interfaces ---

export interface PipelineDefinition {
  id: number
  client: string
  name: string
  table_name: string
  is_active: boolean
  steps: PipelineStep[]
  settings: Record<string, unknown> | null
}

export interface WaterfallSubStep {
  taskId: string
  payload?: Record<string, unknown>
  resetSql?: string
}

export interface PipelineStepAction {
  type: string
  taskId?: string
  waterfallSteps?: WaterfallSubStep[]
  [key: string]: unknown
}

export interface PipelineStep {
  id: string
  name: string
  action?: PipelineStepAction
  task_id?: string
  [key: string]: unknown
}

export interface PipelineRun {
  id: string
  pipeline_def_id: number
  batch_id: string | null
  table_name: string
  client: string
  status: string
  current_step_id: string | null
  steps_completed: number
  steps_total: number
  step_results: Record<string, unknown> | null
  started_at: string
  completed_at: string | null
  error: string | null
}

export interface CampaignPrompt {
  id: number
  name: string
  category: string | null
  system_prompt: string
  user_prompt_template: string
  model: string | null
  client: string | null
  version: number | null
  is_active: boolean
  pipeline_stage: string | null
  email_number: number | null
  persona: string | null
  waterfall_priority: number | null
  prompt_type: string | null
  purpose?: string
  campaign_id?: number
}

export interface GroupedCampaignPrompts {
  [purpose: string]: CampaignPrompt[]
}

export interface PromptDetail {
  id: number
  name: string
  category: string | null
  system_prompt: string
  user_prompt_template: string
  model: string | null
  client: string | null
  version: number | null
  is_active: boolean
  pipeline_stage: string | null
}

// --- Functions ---

export const getClientPipelines = cache(
  async (client: string): Promise<PipelineDefinition[]> => {
    const supabase = createServerClient()

    const { data } = await supabase
      .from("pipeline_definitions")
      .select("id, client, name, table_name, is_active, steps, settings")
      .eq("client", client)
      .order("name", { ascending: true })

    if (!data) return []

    return data.map((row) => ({
      ...row,
      steps: (row.steps ?? []) as PipelineStep[],
      settings: (row.settings ?? null) as Record<string, unknown> | null,
    }))
  }
)

export const getLatestPipelineRun = cache(
  async (pipelineId: number): Promise<PipelineRun | null> => {
    const supabase = createServerClient()

    const { data } = await supabase
      .from("pipeline_runs")
      .select("*")
      .eq("pipeline_def_id", pipelineId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    return (data as PipelineRun | null) ?? null
  }
)

export const getPipelineRuns = cache(
  async (pipelineId: number, limit: number = 10): Promise<PipelineRun[]> => {
    const supabase = createServerClient()

    const { data } = await supabase
      .from("pipeline_runs")
      .select("*")
      .eq("pipeline_def_id", pipelineId)
      .order("created_at", { ascending: false })
      .limit(limit)

    return (data ?? []) as PipelineRun[]
  }
)

export const getCampaignPrompts = cache(
  async (campaignId: number): Promise<GroupedCampaignPrompts> => {
    const supabase = createServerClient()

    const { data } = await supabase
      .from("v_campaign_prompt_registry")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("waterfall_priority", { ascending: true })

    if (!data || data.length === 0) return {}

    const grouped: GroupedCampaignPrompts = {}
    for (const row of data as CampaignPrompt[]) {
      const purpose = row.purpose ?? "uncategorized"
      if (!grouped[purpose]) {
        grouped[purpose] = []
      }
      grouped[purpose].push(row)
    }

    return grouped
  }
)

export const getPromptDetail = cache(
  async (promptId: number): Promise<PromptDetail | null> => {
    const supabase = createServerClient()

    const { data } = await supabase
      .from("prompt_library")
      .select(
        "id, name, category, system_prompt, user_prompt_template, model, client, version, is_active, pipeline_stage"
      )
      .eq("id", promptId)
      .maybeSingle()

    return (data as PromptDetail | null) ?? null
  }
)
