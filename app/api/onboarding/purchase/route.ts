import { createServerClient } from "@/lib/supabase/server"
import { placeOrder } from "@/lib/inboxkit"
import type { OrderDomainResult } from "@/lib/inboxkit"
import type { ClientSetup } from "@/lib/types"

interface Persona {
  first_name: string
  last_name: string
  profile_picture_url: string | null
}

interface SelectedDomain {
  name: string
  tld: string
  price: number
}

// WHOIS contact details for domain registration
const CONTACT_DETAILS = {
  first_name: "Omar",
  last_name: "Almubarak",
  email: "omar.almubarak@omnivate.co.uk",
  phone: "+447724060999",
  organization: "Omnivate",
  address_line1: "Apt 92 Woods House 7 Gatliff Rd",
  city: "London",
  state: "London",
  postal_code: "SW1W 8DE",
  country: "GB",
}

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
    return Response.json(
      { error: "Setup not found" },
      { status: 404 }
    )
  }

  const typedSetup = setup as ClientSetup

  if (!typedSetup.inboxkit_workspace_uid) {
    return Response.json(
      { error: "No InboxKit workspace configured" },
      { status: 400 }
    )
  }

  const personas: Persona[] = Array.isArray(typedSetup.persona_config)
    ? (typedSetup.persona_config as unknown as Persona[])
    : []

  const domains: SelectedDomain[] = Array.isArray(typedSetup.selected_domains)
    ? (typedSetup.selected_domains as unknown as SelectedDomain[])
    : []

  if (personas.length === 0) {
    return Response.json(
      { error: "No personas configured" },
      { status: 400 }
    )
  }

  if (domains.length === 0) {
    return Response.json(
      { error: "No domains selected" },
      { status: 400 }
    )
  }

  const mailboxPerDomain = typedSetup.mailbox_per_domain || 2
  const googleMailboxCount = typedSetup.google_mailbox_count || 0
  const googleDomainCount = Math.ceil(googleMailboxCount / mailboxPerDomain)
  const redirectUrl = typedSetup.redirect_url || ""

  // Build InboxKit order payload
  // First N domains → GOOGLE, remaining → MICROSOFT
  // Each domain gets 2 mailboxes: firstname@ + firstname.lastname@ (same persona)
  // Personas round-robin per domain
  let personaIdx = 0

  const orderDomains = domains.map((domain, domainIdx) => {
    const platform: "GOOGLE" | "MICROSOFT" =
      domainIdx < googleDomainCount ? "GOOGLE" : "MICROSOFT"

    const persona = personas[personaIdx % personas.length]
    const first = persona.first_name.toLowerCase()
    const last = persona.last_name.toLowerCase()

    // 2 mailboxes per domain: firstname@ + firstname.lastname@
    const mailboxes = [
      {
        email: `${first}@${domain.name}`,
        first_name: persona.first_name,
        last_name: persona.last_name,
        platform,
        sequencer_uid: typedSetup.smartlead_sequencer_uid || "",
        profile_pic_url: persona.profile_picture_url || "",
      },
      {
        email: `${first}.${last}@${domain.name}`,
        first_name: persona.first_name,
        last_name: persona.last_name,
        platform,
        sequencer_uid: typedSetup.smartlead_sequencer_uid || "",
        profile_pic_url: persona.profile_picture_url || "",
      },
    ]

    personaIdx++

    return {
      name: domain.name,
      redirect_url: redirectUrl,
      registration_years: 1,
      mailboxes,
    }
  })

  // Update status to purchasing
  await supabase
    .from("client_setups")
    .update({
      status: "purchasing",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", setupId)

  // Mark domains_purchased step as in_progress
  await supabase
    .from("setup_steps")
    .update({
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .eq("setup_id", setupId)
    .eq("step_name", "domains_purchased")

  // Place order with InboxKit
  try {
    const orderResult = await placeOrder(
      typedSetup.inboxkit_workspace_uid,
      {
        contact_details: CONTACT_DETAILS,
        domains: orderDomains,
      }
    )

    // Parse per-domain results — InboxKit returns 201 with individual domain statuses
    const domainResults: OrderDomainResult[] = orderResult?.domains ?? []
    const failedDomains = domainResults.filter(
      (d) => d.error || d.status === "failed"
    )
    const succeededCount = domainResults.length - failedDomains.length
    const totalRequested = orderDomains.length

    // If ALL domains failed, treat as full failure
    if (succeededCount === 0 && totalRequested > 0) {
      const errorSummary = failedDomains
        .slice(0, 5)
        .map((d) => `${d.domain}: ${d.error}`)
        .join("; ")

      await supabase
        .from("client_setups")
        .update({
          status: "configuring",
          error_message: `All ${totalRequested} domains failed: ${errorSummary}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", setupId)

      await supabase
        .from("setup_steps")
        .update({
          status: "failed",
          error_message: `All domains failed`,
          details: {
            order_id: orderResult.id,
            total_requested: totalRequested,
            failed_domains: failedDomains,
          },
        })
        .eq("setup_id", setupId)
        .eq("step_name", "domains_purchased")

      return Response.json(
        { error: `All ${totalRequested} domains failed: ${errorSummary}` },
        { status: 502 }
      )
    }

    // Partial or full success — proceed to provisioning
    if (failedDomains.length > 0) {
      console.warn(
        `[Purchase] ${failedDomains.length}/${totalRequested} domains failed:`,
        failedDomains.map((d) => `${d.domain}: ${d.error}`).join(", ")
      )
    }

    await supabase
      .from("client_setups")
      .update({
        status: "provisioning",
        contact_details: CONTACT_DETAILS,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", setupId)

    // Mark domains_purchased step as completed with full details
    await supabase
      .from("setup_steps")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        details: {
          order_id: orderResult.id,
          total_requested: totalRequested,
          total_succeeded: succeededCount,
          total_failed: failedDomains.length,
          failed_domains: failedDomains.length > 0 ? failedDomains : undefined,
        },
      })
      .eq("setup_id", setupId)
      .eq("step_name", "domains_purchased")

    // Trigger the provision-client-setup task via Trigger.dev REST API
    let triggerRunId: string | null = null
    const triggerSecretKey = process.env.TRIGGER_SECRET_KEY
    if (triggerSecretKey) {
      try {
        const triggerRes = await fetch(
          "https://api.trigger.dev/api/v1/tasks/provision-client-setup/trigger",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${triggerSecretKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              payload: { setupId },
            }),
          }
        )

        if (triggerRes.ok) {
          const triggerData = await triggerRes.json()
          triggerRunId = triggerData.id || null
        } else {
          console.error(
            "Trigger.dev API error:",
            triggerRes.status,
            await triggerRes.text().catch(() => "")
          )
        }
      } catch (triggerErr) {
        console.error("Failed to trigger provisioning task:", triggerErr)
      }
    } else {
      console.warn("TRIGGER_SECRET_KEY not configured — skipping task trigger")
    }

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
      triggerRunId,
      warnings:
        failedDomains.length > 0
          ? {
              message: `${failedDomains.length} of ${totalRequested} domain(s) failed`,
              failedDomains,
            }
          : undefined,
    })
  } catch (err) {
    console.error("InboxKit order failed:", err)

    // Total API failure — revert to configuring
    await supabase
      .from("client_setups")
      .update({
        status: "configuring",
        error_message:
          err instanceof Error ? err.message : "Order placement failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", setupId)

    await supabase
      .from("setup_steps")
      .update({
        status: "failed",
        error_message:
          err instanceof Error ? err.message : "Order placement failed",
      })
      .eq("setup_id", setupId)
      .eq("step_name", "domains_purchased")

    return Response.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to place order with InboxKit",
      },
      { status: 502 }
    )
  }
}
