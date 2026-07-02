import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { triggerTask } from "@/lib/trigger-client"

interface DomainOrderInput {
  domain_name: string
  persona: string
  platform: "google" | "microsoft"
  registration_price: number
}

interface PersonaDetail {
  first_name: string
  last_name: string
  profile_picture_url: string
}

interface OrderBody {
  domains: DomainOrderInput[]
  persona_details: Record<string, PersonaDetail>
  redirect_url: string
  sequencer_uid?: string
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const body = (await req.json()) as OrderBody

  // --- Validate request body ---
  if (!Array.isArray(body.domains) || body.domains.length === 0) {
    return NextResponse.json(
      { error: "domains must be a non-empty array" },
      { status: 400 }
    )
  }
  if (!body.redirect_url || typeof body.redirect_url !== "string") {
    return NextResponse.json(
      { error: "redirect_url is required" },
      { status: 400 }
    )
  }
  if (!body.persona_details || typeof body.persona_details !== "object") {
    return NextResponse.json(
      { error: "persona_details is required" },
      { status: 400 }
    )
  }

  for (const d of body.domains) {
    if (!d.domain_name || !d.persona || !d.platform) {
      return NextResponse.json(
        { error: `Missing required fields for domain: ${d.domain_name || "(unnamed)"}` },
        { status: 400 }
      )
    }
    if (!body.persona_details[d.persona]) {
      return NextResponse.json(
        { error: `No persona details provided for "${d.persona}"` },
        { status: 400 }
      )
    }
  }

  const supabase = createServerClient()
  const domainNames = body.domains.map((d) => d.domain_name)

  // --- Validate all domains exist as available candidates for this client ---
  const { data: candidates, error: candidateErr } = await supabase
    .from("mailbox_domain_candidates")
    .select("domain_name")
    .eq("client", slug)
    .eq("available", true)
    .eq("status", "candidate")
    .in("domain_name", domainNames)

  if (candidateErr) {
    return NextResponse.json(
      { error: `Failed to validate domains: ${candidateErr.message}` },
      { status: 500 }
    )
  }

  const foundNames = new Set((candidates ?? []).map((c: any) => c.domain_name))
  const missing = domainNames.filter((n) => !foundNames.has(n))
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Domains not available as candidates: ${missing.join(", ")}` },
      { status: 400 }
    )
  }

  // --- Build task payload: map modal format → task format ---
  const taskDomains = body.domains.map((d) => {
    const persona = body.persona_details[d.persona]
    return {
      domain_name: d.domain_name,
      persona: d.persona,
      first_name: persona.first_name,
      last_name: persona.last_name,
      platform: d.platform.toUpperCase() as "GOOGLE" | "MICROSOFT",
      profile_pic_url: persona.profile_picture_url || undefined,
    }
  })

  // --- Trigger the background task ---
  try {
    const { runId } = await triggerTask("place-inboxkit-order-multi", {
      client: slug,
      domains: taskDomains,
      redirect_url: body.redirect_url,
      ...(body.sequencer_uid ? { sequencer_uid: body.sequencer_uid } : {}),
    })

    // Store runId on the order row so the frontend can poll status
    // The task creates the order row before this returns, but it's async —
    // update any recent order for this client that doesn't have a runId yet
    await supabase
      .from("mailbox_orders")
      .update({ monitoring_task_run_id: runId })
      .eq("client", slug)
      .is("monitoring_task_run_id", null)
      .eq("status", "placed")

    return NextResponse.json({ ok: true, runId })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
