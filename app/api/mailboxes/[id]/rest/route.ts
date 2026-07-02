import { createServerClient } from "@/lib/supabase/server"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const accountId = Number(id)

  if (!accountId || !Number.isFinite(accountId)) {
    return Response.json(
      { error: "Invalid account ID" },
      { status: 400 }
    )
  }

  const supabase = createServerClient()
  const { data: account } = await supabase
    .from("mailbox_accounts")
    .select("id, email, domain_name, domain_id, lifecycle_status, client")
    .eq("id", accountId)
    .single()

  if (!account) {
    return Response.json({ error: "Account not found" }, { status: 404 })
  }

  if (account.lifecycle_status !== "active") {
    return Response.json(
      { error: "Only active accounts can be rested" },
      { status: 400 }
    )
  }

  try {
    // Move account to reserve status
    await supabase
      .from("mailbox_accounts")
      .update({ lifecycle_status: "reserve" })
      .eq("id", accountId)

    // Log action
    await supabase.from("mailbox_actions_log").insert({
      account_id: accountId,
      domain_id: account.domain_id,
      action_type: "rest",
      status: "completed",
      details: {
        previous_status: "active",
        new_status: "reserve",
        reason: "Manual rest — pausing campaign sends, continuing warmup",
      },
    })

    return Response.json({
      status: "completed",
      email: account.email,
    })
  } catch (err) {
    console.error("Failed to rest mailbox:", err)
    return Response.json(
      { error: "Failed to rest mailbox" },
      { status: 500 }
    )
  }
}
