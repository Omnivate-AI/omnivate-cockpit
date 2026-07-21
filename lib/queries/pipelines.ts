import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import { resolveClientSlugs } from "@/lib/queries/clients"

// --- Interfaces ---

/** One step of a Pipeline-Engine v2/v3 campaign (`campaign_steps`). Carries
    REAL dependency data — `dependencies` (array of step IDs, v2/v3) or the
    single legacy `depends_on_step` — which is what makes the true DAG
    rendering possible (V4 D2). */
export interface EngineCampaignStep {
  id: number
  step_order: number
  name: string
  step_type: string | null
  depends_on_step: number | null
  dependencies: number[] | null
  parallelizable: boolean | null
  has_condition: boolean
  is_active: boolean
}

/** A Pipeline-Engine campaign (`campaigns` registry — the modern v2/v3
    builds, e.g. "Cylindo Stage 2 Personalization"), distinct from the legacy
    `pipeline_definitions` monoliths. */
export interface EngineCampaign {
  id: number
  name: string
  client: string
  status: string | null
  engine_version: string | null
  lead_table: string | null
  description: string | null
  updated_at: string | null
  steps: EngineCampaignStep[]
}

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

/** Engine campaigns for a client (parent slugs resolved), steps attached and
    ordered. Retired/archived campaigns excluded — this powers the Pipelines
    tab's "true shape of the build" section (V4 D1/D2). */
export const getClientEngineCampaigns = cache(
  async (client: string): Promise<EngineCampaign[]> => {
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)

    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("id, name, client, status, engine_version, lead_table, description, updated_at")
      .in("client", slugs)
      .not("status", "in", "(retired,archived)")
      .order("updated_at", { ascending: false })

    if (!campaigns || campaigns.length === 0) return []

    const ids = campaigns.map((c) => c.id)
    const { data: steps } = await supabase
      .from("campaign_steps")
      .select(
        "id, campaign_id, step_order, name, step_type, depends_on_step, dependencies, parallelizable, condition, is_active"
      )
      .in("campaign_id", ids)
      .order("step_order", { ascending: true })

    type StepRow = {
      id: number
      campaign_id: number
      step_order: number | null
      name: string
      step_type: string | null
      depends_on_step: number | null
      dependencies: unknown
      parallelizable: boolean | null
      condition: unknown
      is_active: boolean | null
    }
    const byCampaign = new Map<number, EngineCampaignStep[]>()
    for (const s of (steps ?? []) as StepRow[]) {
      const list = byCampaign.get(s.campaign_id) ?? []
      list.push({
        id: s.id,
        step_order: s.step_order ?? 0,
        name: s.name,
        step_type: s.step_type,
        depends_on_step: s.depends_on_step,
        dependencies: Array.isArray(s.dependencies)
          ? (s.dependencies as unknown[]).map(Number).filter(Number.isFinite)
          : null,
        parallelizable: s.parallelizable,
        has_condition: s.condition != null,
        is_active: s.is_active ?? true,
      })
      byCampaign.set(s.campaign_id, list)
    }

    return campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      client: c.client,
      status: c.status,
      engine_version: c.engine_version,
      lead_table: c.lead_table,
      description: c.description,
      updated_at: c.updated_at,
      steps: byCampaign.get(c.id) ?? [],
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
