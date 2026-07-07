import { createServerClient } from "@/lib/supabase/server"
import { FLAGS } from "@/lib/flags"

// Build-5 5.1b — "Request order" raises a pending order_mailboxes decision
// from the cockpit. Same decision_type the order-engine + Slack button
// understand, so the existing approval + supervised place-step handle it.
//
// SAFETY: this only QUEUES a request (status='pending', needs approval).
// It does NOT size the bench, does NOT place anything, and NEVER spends —
// a supervised order-engine run computes the real gap/cost and places via
// InboxKit after the decision is approved. Deduped: if an open
// order_mailboxes decision already exists for the client, we surface it
// instead of stacking duplicates (matches order-engine's one-open-decision rule).

const OPEN_STATES = ["proposed", "pending", "awaiting_approval", "approved"]

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!FLAGS.infraOrderRequest) {
    return Response.json({ error: "Order requests are disabled" }, { status: 403 })
  }

  const { slug } = await params
  if (!slug) return Response.json({ error: "Missing client" }, { status: 400 })

  let note: string | undefined
  try {
    const body = await request.json().catch(() => ({}))
    note = typeof body.note === "string" ? body.note : undefined
  } catch {
    /* no body is fine */
  }

  const supabase = createServerClient()

  // Dedupe against any already-open order decision for this client.
  const { data: existing } = await supabase
    .from("sp_decisions")
    .select("id, status, title")
    .eq("client", slug)
    .eq("decision_type", "order_mailboxes")
    .in("status", OPEN_STATES)
    .order("created_at", { ascending: false })
    .limit(1)

  if (existing && existing.length > 0) {
    return Response.json({
      success: true,
      deduped: true,
      existingId: existing[0].id,
      status: existing[0].status,
      message: `An order decision (#${existing[0].id}, ${existing[0].status}) is already open for ${slug}.`,
    })
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("sp_decisions")
    .insert({
      client: slug,
      decision_type: "order_mailboxes",
      severity: "medium",
      status: "pending",
      title: `order-request:${slug} (cockpit)`,
      rationale:
        "Manual order request raised from the cockpit. A supervised order-engine run will size the reserve-bench gap and place the InboxKit order after this decision is approved." +
        (note ? ` Note: ${note.slice(0, 200)}` : ""),
      proposed_payload: {
        action: "order_mailboxes",
        order_type: "manual_request",
        client: slug,
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
      { error: error?.message ?? "Failed to raise order request" },
      { status: 500 }
    )
  }

  return Response.json({ success: true, id: data.id, status: "pending" })
}
