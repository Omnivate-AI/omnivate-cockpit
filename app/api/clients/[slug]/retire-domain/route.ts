import { createServerClient } from "@/lib/supabase/server"
import { FLAGS } from "@/lib/flags"

// V2 Phase 7 — "Retire Domain" raises a pending retire_domain decision from
// the cockpit (domain-scoped). Mirrors request-order's safety envelope:
//
// SAFETY: this only QUEUES a proposal (status='pending', needs approval).
// It does NOT stop sending, does NOT cancel InboxKit billing, does NOT touch
// Smartlead, and NEVER spends or destroys. A SUPERVISED email-infra
// retire-engine run performs the actual drain + InboxKit cancel + catch-all
// + tag ONLY after the decision is approved. Deduped per domain: if an open
// retire_domain decision already exists for this domain, we surface it
// instead of stacking duplicates.
//
// Replaces the old button wiring to /api/domains/drain (a disabled 410 stub
// on the retired mailbox_* control-plane model).

const OPEN_STATES = ["proposed", "pending", "awaiting_approval", "approved"]

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!FLAGS.infraRetireDomain) {
    return Response.json(
      { error: "Domain retirement requests are disabled" },
      { status: 403 }
    )
  }

  const { slug } = await params
  if (!slug) return Response.json({ error: "Missing client" }, { status: 400 })

  let domainName: string | undefined
  let mailboxCount: number | undefined
  let note: string | undefined
  try {
    const body = await request.json().catch(() => ({}))
    domainName =
      typeof body.domain_name === "string" ? body.domain_name.trim() : undefined
    mailboxCount =
      typeof body.mailbox_count === "number" && Number.isFinite(body.mailbox_count)
        ? body.mailbox_count
        : undefined
    note = typeof body.note === "string" ? body.note : undefined
  } catch {
    /* no body */
  }

  if (!domainName) {
    return Response.json({ error: "Missing domain_name" }, { status: 400 })
  }

  const supabase = createServerClient()

  // Dedupe against any already-open retire decision for THIS domain. The
  // decision_type is shared across the client, so match on the payload's
  // domain_name to allow different domains of the same client to each have
  // their own open retire proposal.
  const { data: existing } = await supabase
    .from("sp_decisions")
    .select("id, status, proposed_payload")
    .eq("client", slug)
    .eq("decision_type", "retire_domain")
    .in("status", OPEN_STATES)
    .order("created_at", { ascending: false })
    .limit(50)

  const dupe = (existing ?? []).find(
    (d) =>
      (d.proposed_payload as Record<string, unknown> | null)?.domain_name ===
      domainName
  )
  if (dupe) {
    return Response.json({
      success: true,
      deduped: true,
      existingId: dupe.id,
      status: dupe.status,
      message: `A retire decision (#${dupe.id}, ${dupe.status}) is already open for ${domainName}.`,
    })
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("sp_decisions")
    .insert({
      client: slug,
      decision_type: "retire_domain",
      // Retiring infrastructure is destructive + billing-affecting → high.
      severity: "high",
      status: "pending",
      title: `retire-domain:${domainName} (cockpit)`,
      rationale:
        `Manual domain-retirement request raised from the cockpit for ${domainName}` +
        (mailboxCount ? ` (${mailboxCount} mailbox${mailboxCount === 1 ? "" : "es"})` : "") +
        ". After approval, a supervised email-infra retire-engine run stops sending, cancels the InboxKit subscriptions, sets catch-all to the master inbox, tags the boxes retired, and deploys reserves. Approval alone charges/destroys nothing." +
        (note ? ` Note: ${note.slice(0, 200)}` : ""),
      proposed_payload: {
        action: "retire_domain",
        domain_name: domainName,
        client: slug,
        mailbox_count: mailboxCount ?? null,
        source: "cockpit_manual",
        requested_by: "cockpit",
      },
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single()

  if (error || !data) {
    return Response.json(
      { error: error?.message ?? "Failed to raise retire request" },
      { status: 500 }
    )
  }

  return Response.json({ success: true, id: data.id, status: "pending" })
}
