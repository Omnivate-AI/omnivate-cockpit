import { createServerClient } from "@/lib/supabase/server"

export async function PATCH(request: Request) {
  const body = await request.json()
  const { setupId, ...updates } = body as {
    setupId?: number
    [key: string]: unknown
  }

  if (!setupId) {
    return Response.json(
      { error: "setupId is required" },
      { status: 400 }
    )
  }

  // Whitelist allowed fields to prevent arbitrary updates
  const allowedFields = [
    "selected_domains",
    "domain_count",
    "mailbox_per_domain",
    "total_mailboxes",
    "estimated_cost_usd",
    "wallet_balance_usd",
    "google_mailbox_count",
    "microsoft_mailbox_count",
    "persona_config",
    "redirect_url",
    "contact_details",
    "display_name",
    "email_format",
    "status",
  ]

  const safeUpdates: Record<string, unknown> = {}
  for (const key of allowedFields) {
    if (key in updates) {
      safeUpdates[key] = updates[key]
    }
  }

  if (Object.keys(safeUpdates).length === 0) {
    return Response.json(
      { error: "No valid fields to update" },
      { status: 400 }
    )
  }

  safeUpdates.updated_at = new Date().toISOString()

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from("client_setups")
    .update(safeUpdates)
    .eq("id", setupId)
    .select("id")
    .single()

  if (error || !data) {
    console.error("Failed to update setup:", error)
    return Response.json(
      { error: "Failed to update setup" },
      { status: 500 }
    )
  }

  return Response.json({ success: true })
}
