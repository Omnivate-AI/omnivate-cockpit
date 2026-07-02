import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const { clientName, newMasterAccountId } = await request.json()

  if (!clientName || typeof clientName !== "string") {
    return Response.json(
      { error: "clientName is required and must be a string" },
      { status: 400 }
    )
  }

  if (!newMasterAccountId || typeof newMasterAccountId !== "number") {
    return Response.json(
      { error: "newMasterAccountId is required and must be a number" },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  // Verify the target account exists and belongs to this client
  const { data: account } = await supabase
    .from("mailbox_accounts")
    .select("id, email, domain_id, client")
    .eq("id", newMasterAccountId)
    .single()

  if (!account) {
    return Response.json({ error: "Account not found" }, { status: 404 })
  }

  if (account.client !== clientName) {
    return Response.json(
      { error: "Account does not belong to this client" },
      { status: 400 }
    )
  }

  // Clear existing master inbox flag on accounts for this client
  const { error: clearAccountErr } = await supabase
    .from("mailbox_accounts")
    .update({ is_master_inbox: false })
    .eq("client", clientName)
    .eq("is_master_inbox", true)

  if (clearAccountErr) {
    console.error("Failed to clear old master account:", clearAccountErr)
    return Response.json(
      { error: "Failed to clear existing master inbox" },
      { status: 500 }
    )
  }

  // Set new master inbox account
  const { error: setAccountErr } = await supabase
    .from("mailbox_accounts")
    .update({ is_master_inbox: true })
    .eq("id", newMasterAccountId)

  if (setAccountErr) {
    console.error("Failed to set new master account:", setAccountErr)
    return Response.json(
      { error: "Failed to set new master inbox account" },
      { status: 500 }
    )
  }

  // Clear old domain master flag for this client
  const { error: clearDomainErr } = await supabase
    .from("mailbox_domains")
    .update({ is_master_inbox: false })
    .eq("client", clientName)
    .eq("is_master_inbox", true)

  if (clearDomainErr) {
    console.error("Failed to clear old master domain:", clearDomainErr)
  }

  // Set new domain master flag
  const { error: setDomainErr } = await supabase
    .from("mailbox_domains")
    .update({ is_master_inbox: true })
    .eq("id", account.domain_id)

  if (setDomainErr) {
    console.error("Failed to set new master domain:", setDomainErr)
  }

  // Log the action
  await supabase.from("mailbox_actions_log").insert({
    domain_id: account.domain_id,
    action_type: "set_master_inbox",
    status: "completed",
    details: {
      client: clientName,
      account_id: newMasterAccountId,
      email: account.email,
    },
    triggered_by: "web_app",
  })

  return Response.json({ success: true })
}
