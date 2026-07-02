import { createServerClient } from "@/lib/supabase/server"
import { inboxkitFetch } from "@/lib/inboxkit"
import type { StepName, ClientSetup } from "@/lib/types"

const RETRYABLE_STEPS: StepName[] = [
  "domains_purchased",
  "dns_propagated",
  "mailboxes_provisioned",
  "smartlead_exported",
]

async function triggerProvisionTask(setupId: number): Promise<string | null> {
  const triggerSecretKey = process.env.TRIGGER_SECRET_KEY
  if (!triggerSecretKey) {
    console.warn("TRIGGER_SECRET_KEY not configured — cannot re-trigger")
    return null
  }

  const res = await fetch(
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

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Trigger.dev API error (${res.status}): ${text}`)
  }

  const data = await res.json()
  return data.id || null
}

export async function POST(request: Request) {
  const body = await request.json()
  const { setupId, stepName } = body as {
    setupId?: number
    stepName?: StepName
  }

  if (!setupId || !stepName) {
    return Response.json(
      { error: "setupId and stepName are required" },
      { status: 400 }
    )
  }

  if (!RETRYABLE_STEPS.includes(stepName)) {
    return Response.json(
      { error: `Step '${stepName}' is not retryable. Retryable steps: ${RETRYABLE_STEPS.join(", ")}` },
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

  // Load the step to verify it's actually failed
  const { data: step, error: stepError } = await supabase
    .from("setup_steps")
    .select("*")
    .eq("setup_id", setupId)
    .eq("step_name", stepName)
    .single()

  if (stepError || !step) {
    return Response.json({ error: "Step not found" }, { status: 404 })
  }

  if (step.status !== "failed") {
    return Response.json(
      { error: `Step is '${step.status}', not 'failed'. Only failed steps can be retried.` },
      { status: 400 }
    )
  }

  try {
    let details: Record<string, unknown> = {}

    // Step-specific pre-retry actions
    if (stepName === "dns_propagated") {
      // Regenerate nameservers for domains with expired propagation
      if (typedSetup.inboxkit_workspace_uid) {
        const domainsRes = await inboxkitFetch(
          "/v1/api/domains",
          typedSetup.inboxkit_workspace_uid
        )
        const domains = Array.isArray(domainsRes)
          ? domainsRes
          : domainsRes?.data ?? domainsRes?.domains ?? []

        const expiredIds = domains
          .filter(
            (d: { status?: string; propagation_status?: string }) =>
              d.status === "expired_propagation" ||
              d.status === "expired" ||
              d.propagation_status === "expired"
          )
          .map((d: { id: number }) => d.id)

        if (expiredIds.length > 0) {
          await inboxkitFetch(
            "/v1/api/domains/regenerate-nameservers",
            typedSetup.inboxkit_workspace_uid,
            {
              method: "POST",
              body: JSON.stringify({ domain_ids: expiredIds }),
            }
          )
          details.nameservers_regenerated = expiredIds.length
        }

        details.total_domains = domains.length
        details.expired_domains = expiredIds.length
      }
    }

    // Reset step to pending
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
      .eq("step_name", stepName)

    // Reset setup status to provisioning if it was failed
    if (typedSetup.status === "failed") {
      await supabase
        .from("client_setups")
        .update({
          status: "provisioning",
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", setupId)
    }

    // Re-trigger the provisioning task
    const triggerRunId = await triggerProvisionTask(setupId)

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
        stepName,
        triggerRunId,
        ...details,
      },
    })
  } catch (err) {
    console.error(`Retry step '${stepName}' failed:`, err)
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Retry failed",
      },
      { status: 502 }
    )
  }
}
