import { createServerClient } from "@/lib/supabase/server"
import { createWorkspace, createTag } from "@/lib/inboxkit"
import type { StepName } from "@/lib/types"

const ALL_STEP_NAMES: StepName[] = [
  "workspace_created",
  "domains_purchased",
  "dns_propagated",
  "mailboxes_provisioned",
  "catch_all_configured",
  "profile_pictures_set",
  "smartlead_sequencer_created",
  "smartlead_exported",
  "smartlead_tagged",
  "inventory_synced",
]

export async function POST(request: Request) {
  const body = await request.json()
  const { displayName, slug, redirectUrl, domainCount } = body as {
    displayName?: string
    slug?: string
    redirectUrl?: string
    domainCount?: number
  }

  if (!displayName || !slug) {
    return Response.json(
      { error: "displayName and slug are required" },
      { status: 400 }
    )
  }

  // Validate slug format
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) {
    return Response.json(
      { error: "slug must be lowercase alphanumeric with optional hyphens" },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  // Check slug uniqueness
  const { data: existing } = await supabase
    .from("client_setups")
    .select("id")
    .eq("client_slug", slug)
    .limit(1)

  if (existing && existing.length > 0) {
    return Response.json(
      { error: "A client with this slug already exists" },
      { status: 409 }
    )
  }

  // Create InboxKit workspace
  let workspaceUid: string
  let tagId: string
  try {
    const workspace = await createWorkspace(displayName)
    workspaceUid = workspace.uid

    const tag = await createTag(workspaceUid, slug)
    tagId = tag.id
  } catch (err) {
    console.error("InboxKit workspace/tag creation failed:", err)
    return Response.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to create InboxKit workspace",
      },
      { status: 502 }
    )
  }

  // Insert client_setups row
  const { data: setup, error: setupError } = await supabase
    .from("client_setups")
    .insert({
      client_slug: slug,
      display_name: displayName,
      status: "configuring",
      inboxkit_workspace_uid: workspaceUid,
      inboxkit_tag_uid: tagId,
      redirect_url: redirectUrl || null,
      domain_count: domainCount || 50,
    })
    .select("id")
    .single()

  if (setupError || !setup) {
    console.error("Failed to insert client_setups:", setupError)
    return Response.json(
      { error: "Failed to create setup record" },
      { status: 500 }
    )
  }

  // Insert 10 setup_steps rows
  const stepRows = ALL_STEP_NAMES.map((stepName, idx) => ({
    setup_id: setup.id,
    step_name: stepName,
    status: idx === 0 ? "completed" : "pending",
    ...(idx === 0
      ? { started_at: new Date().toISOString(), completed_at: new Date().toISOString() }
      : {}),
  }))

  const { error: stepsError } = await supabase
    .from("setup_steps")
    .insert(stepRows)

  if (stepsError) {
    console.error("Failed to insert setup_steps:", stepsError)
    return Response.json(
      { error: "Failed to create setup steps" },
      { status: 500 }
    )
  }

  return Response.json({
    setupId: setup.id,
    workspaceUid,
  })
}
