import { createServerClient } from "@/lib/supabase/server"
import { triggerTask, isTriggerConfigured } from "@/lib/trigger-client"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const domainId = Number(id)

  if (!domainId || !Number.isFinite(domainId)) {
    return Response.json(
      { error: "Invalid domain ID" },
      { status: 400 }
    )
  }

  const supabase = createServerClient()
  const { data: domain } = await supabase
    .from("mailbox_domains")
    .select("id, domain_name, lifecycle_status, client")
    .eq("id", domainId)
    .single()

  if (!domain) {
    return Response.json({ error: "Domain not found" }, { status: 404 })
  }

  if (domain.lifecycle_status !== "burnt") {
    return Response.json(
      { error: "Only burnt domains can be rotated" },
      { status: 400 }
    )
  }

  if (!isTriggerConfigured()) {
    return Response.json(
      { error: "TRIGGER_SECRET_KEY not configured" },
      { status: 500 }
    )
  }

  try {
    // Log action as pending
    await supabase.from("mailbox_actions_log").insert({
      domain_id: domainId,
      action_type: "rotate",
      status: "pending",
    })

    const { runId } = await triggerTask("rotate-burnt-domain", {
      domainId,
    })

    return Response.json({
      runId,
      status: "triggered",
      domain: domain.domain_name,
    })
  } catch (err) {
    console.error("Failed to trigger rotation task:", err)
    return Response.json(
      { error: "Failed to trigger rotation task" },
      { status: 502 }
    )
  }
}
