import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { triggerTask } from "@/lib/trigger-client"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { client, domain_name } = body as {
    client?: string
    domain_name?: string
  }

  if (!client || !domain_name) {
    return NextResponse.json(
      { error: "client and domain_name are required" },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  // Validate domain exists, is burnt, and belongs to this client
  const { data: domain } = await supabase
    .from("mailbox_domains")
    .select("id, lifecycle_status, client")
    .eq("domain_name", domain_name)
    .eq("client", client)
    .maybeSingle()

  if (!domain) {
    return NextResponse.json(
      { error: `Domain ${domain_name} not found for client ${client}` },
      { status: 404 }
    )
  }

  if (domain.lifecycle_status === "draining") {
    return NextResponse.json(
      { error: `Domain ${domain_name} is already draining` },
      { status: 409 }
    )
  }

  if (domain.lifecycle_status === "retired") {
    return NextResponse.json(
      { error: `Domain ${domain_name} is already retired` },
      { status: 409 }
    )
  }

  // Trigger drain-and-swap task
  try {
    const { runId } = await triggerTask("drain-and-swap", {
      client,
      domain_name,
      reason: `burnt — drain initiated from app`,
      dryRun: false,
    })

    return NextResponse.json({ ok: true, runId, domain_name })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
