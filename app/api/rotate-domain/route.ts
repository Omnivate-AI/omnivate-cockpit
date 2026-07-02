import { createServerClient } from "@/lib/supabase/server"
import { triggerTask, isTriggerConfigured } from "@/lib/trigger-client"

export async function POST(request: Request) {
  const { domainId, alertId } = await request.json()

  if (!domainId || typeof domainId !== "number") {
    return Response.json(
      { error: "domainId is required and must be a number" },
      { status: 400 }
    )
  }

  // Verify domain exists and is burnt
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
    const { runId } = await triggerTask("rotate-burnt-domain", {
      domainId,
      alertId: alertId ?? null,
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
