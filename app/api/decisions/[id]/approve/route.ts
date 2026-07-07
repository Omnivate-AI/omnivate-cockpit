import { createServerClient } from "@/lib/supabase/server"
import { FLAGS } from "@/lib/flags"

// Build-5 5.1a — in-app Approve / Deny on an email-infra sp_decisions row.
// Mirrors the Slack approve Edge Function EXACTLY:
//   * flips status → 'approved' | 'denied' with approved_by / approved_at
//   * if proposed_payload.order_id, patches the sp_orders row to match
//   * IDEMPOTENT — a decision resolves exactly once; a call on an already
//     approved/denied/executed decision changes nothing.
// SAFETY: approval only MARKS the decision. It does NOT spend and does NOT
// place any order — the actual InboxKit purchase stays a separate supervised
// order-engine run. Both this route and the Slack button write the same
// status, so either can approve and the engines are indifferent.

const RESOLVABLE = new Set(["proposed", "pending"])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!FLAGS.infraDecisionApprove) {
    return Response.json({ error: "Decision actions are disabled" }, { status: 403 })
  }

  const { id } = await params
  const decisionId = parseInt(id, 10)
  if (isNaN(decisionId)) {
    return Response.json({ error: "Invalid decision ID" }, { status: 400 })
  }

  let approve: boolean
  let note: string | undefined
  try {
    const body = await request.json()
    if (typeof body.approve !== "boolean") throw new Error("missing approve")
    approve = body.approve
    note = typeof body.note === "string" ? body.note : undefined
  } catch {
    return Response.json(
      { error: "Body must be { approve: boolean, note?: string }" },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  const { data: decision, error: readErr } = await supabase
    .from("sp_decisions")
    .select("id, status, decision_type, proposed_payload, approved_by")
    .eq("id", decisionId)
    .maybeSingle()

  if (readErr) return Response.json({ error: readErr.message }, { status: 500 })
  if (!decision) return Response.json({ error: "Decision not found" }, { status: 404 })

  // Idempotency guard — resolve exactly once (matches the Slack fn).
  if (!RESOLVABLE.has(decision.status)) {
    return Response.json({
      success: true,
      alreadyResolved: true,
      status: decision.status,
      message: `Decision #${decisionId} is already ${decision.status}${decision.approved_by ? ` (by ${decision.approved_by})` : ""} — nothing changed.`,
    })
  }

  const now = new Date().toISOString()
  const status = approve ? "approved" : "denied"
  // sp_decisions has no note column — fold a deny reason into approved_by so
  // it stays visible without a schema change (mirrors the Slack fn's field set).
  const approvedBy = note ? `cockpit (${note.slice(0, 80)})` : "cockpit"

  const { error: updErr } = await supabase
    .from("sp_decisions")
    .update({
      status,
      approved_by: approvedBy,
      approved_at: now,
      updated_at: now,
    })
    .eq("id", decisionId)
    .eq("status", decision.status) // optimistic lock: only if unchanged since read

  if (updErr) return Response.json({ error: updErr.message }, { status: 500 })

  // Mirror the Slack fn: keep the linked order row in lockstep.
  const orderId =
    decision.proposed_payload &&
    (decision.proposed_payload as Record<string, unknown>).order_id
  if (orderId) {
    await supabase
      .from("sp_orders")
      .update({ status, updated_at: now })
      .eq("id", orderId as number)
  }

  return Response.json({ success: true, id: decisionId, status })
}
