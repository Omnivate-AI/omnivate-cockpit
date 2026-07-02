import { createServerClient } from "@/lib/supabase/server"
import type { ClientSetup } from "@/lib/types"

export async function POST(request: Request) {
  const body = await request.json()
  const { setupId } = body as { setupId?: number }

  if (!setupId) {
    return Response.json(
      { error: "setupId is required" },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  // Load setup
  const { data: setup, error: setupError } = await supabase
    .from("client_setups")
    .select("*")
    .eq("id", setupId)
    .single()

  if (setupError || !setup) {
    return Response.json({ error: "Setup not found" }, { status: 404 })
  }

  const typedSetup = setup as ClientSetup

  // Verify the setup is in a state where Smartlead phase makes sense
  // Domain phase should be done (mailboxes_provisioned completed or catch_all/profile_pictures done)
  const { data: steps } = await supabase
    .from("setup_steps")
    .select("step_name, status")
    .eq("setup_id", setupId)

  const stepMap = new Map<string, string>()
  for (const step of steps ?? []) {
    stepMap.set(step.step_name, step.status)
  }

  // Check that domain/mailbox phase is at least partially complete
  const mailboxStep = stepMap.get("mailboxes_provisioned")
  if (mailboxStep !== "completed") {
    return Response.json(
      {
        error: "Mailbox provisioning must be completed before triggering Smartlead phase",
        currentStatus: mailboxStep,
      },
      { status: 400 }
    )
  }

  // Check that Smartlead phase hasn't already completed
  const seqStep = stepMap.get("smartlead_sequencer_created")
  const exportStep = stepMap.get("smartlead_exported")
  const tagStep = stepMap.get("smartlead_tagged")

  if (
    seqStep === "completed" &&
    exportStep === "completed" &&
    tagStep === "completed"
  ) {
    return Response.json(
      { error: "Smartlead phase already completed" },
      { status: 400 }
    )
  }

  try {
    // Reset Smartlead steps that are failed or pending
    const smartleadSteps = [
      "smartlead_sequencer_created",
      "smartlead_exported",
      "smartlead_tagged",
      "inventory_synced",
    ]

    for (const sn of smartleadSteps) {
      const status = stepMap.get(sn)
      if (status === "failed" || status === "pending") {
        await supabase
          .from("setup_steps")
          .update({
            status: "pending",
            error_message: null,
            started_at: null,
            completed_at: null,
            details: null,
          })
          .eq("setup_id", setupId)
          .eq("step_name", sn)
      }
    }

    // Set status to provisioning if not already
    if (typedSetup.status !== "provisioning") {
      await supabase
        .from("client_setups")
        .update({
          status: "provisioning",
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", setupId)
    }

    // Trigger the provisioning task — it will detect already-completed steps
    // and skip to the Smartlead phase
    const triggerSecretKey = process.env.TRIGGER_SECRET_KEY
    if (!triggerSecretKey) {
      return Response.json(
        { error: "TRIGGER_SECRET_KEY not configured" },
        { status: 500 }
      )
    }

    const triggerRes = await fetch(
      "https://api.trigger.dev/api/v1/tasks/provision-client-setup/trigger",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${triggerSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payload: { setupId } }),
      }
    )

    if (!triggerRes.ok) {
      const text = await triggerRes.text().catch(() => "")
      throw new Error(`Trigger.dev API error (${triggerRes.status}): ${text}`)
    }

    const triggerData = await triggerRes.json()
    const triggerRunId = triggerData.id || null

    if (triggerRunId) {
      await supabase
        .from("client_setups")
        .update({
          trigger_run_id: triggerRunId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", setupId)
    }

    return Response.json({
      success: true,
      details: {
        triggerRunId,
        smartleadStepsReset: smartleadSteps.filter(
          (sn) => stepMap.get(sn) === "failed" || stepMap.get(sn) === "pending"
        ),
      },
    })
  } catch (err) {
    console.error("Trigger Smartlead phase failed:", err)
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Failed to trigger Smartlead phase",
      },
      { status: 502 }
    )
  }
}
