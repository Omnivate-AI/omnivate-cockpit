import { createServerClient } from "@/lib/supabase/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const accountId = Number(id)

  if (!accountId || !Number.isFinite(accountId)) {
    return Response.json({ error: "Invalid account ID" }, { status: 400 })
  }

  const supabase = createServerClient()

  // Get the mailbox to find its domain_id
  const { data: account } = await supabase
    .from("sp_mailboxes")
    .select("id, domain_id")
    .eq("id", accountId)
    .single()

  if (!account) {
    return Response.json({ error: "Account not found" }, { status: 404 })
  }

  // Fetch events for this mailbox OR its domain from the audited actions log
  const { data: events } = await supabase
    .from("sp_actions_log")
    .select(
      "id, action_type, action_status, details, created_at, executed_at, error"
    )
    .or(
      account.domain_id
        ? `account_id.eq.${accountId},domain_id.eq.${account.domain_id}`
        : `account_id.eq.${accountId}`
    )
    .order("created_at", { ascending: false })
    .limit(10)

  return Response.json({ events: events ?? [] })
}
