import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { inboxkitFetch } from "@/lib/inboxkit"

const PERSONA_NAMES: Record<string, { first: string; last: string }> = {
  josh: { first: "josh", last: "arnold" },
  james: { first: "james", last: "ford" },
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params
  const supabase = createServerClient()

  // 1. Fetch the order
  const { data: order, error } = await supabase
    .from("mailbox_orders")
    .select("selected_domains, inboxkit_workspace_uid")
    .eq("id", id)
    .eq("client", slug)
    .single()

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  if (!order.inboxkit_workspace_uid) {
    return NextResponse.json(
      { error: "Order has no workspace UID — not yet submitted to InboxKit" },
      { status: 404 }
    )
  }

  // 2. Build expected emails from selected_domains
  const selectedDomains: Array<{ name: string; persona: string; platform: string }> =
    order.selected_domains ?? []

  const expectedEmails: string[] = []
  for (const domain of selectedDomains) {
    const persona = PERSONA_NAMES[domain.persona] ?? PERSONA_NAMES.josh
    expectedEmails.push(`${persona.first}@${domain.name}`)
    expectedEmails.push(`${persona.first}.${persona.last}@${domain.name}`)
  }

  // 3. Fetch mailboxes from InboxKit
  const ikResult = await inboxkitFetch(
    "/v1/api/mailboxes/list",
    order.inboxkit_workspace_uid,
    {
      method: "POST",
      body: JSON.stringify({ page: 1, limit: 200 }),
    }
  )

  const ikMailboxes: Array<{ username: string; domain_name: string; status: string }> =
    ikResult?.mailboxes ?? []

  // 4. Match expected emails against InboxKit mailboxes
  // InboxKit stores username + domain_name separately, not as a single email field
  const ikByEmail = new Map<string, string>()
  for (const mb of ikMailboxes) {
    const fullEmail = `${mb.username}@${mb.domain_name}`.toLowerCase()
    ikByEmail.set(fullEmail, mb.status?.toLowerCase())
  }

  const byStatus: Record<string, number> = {}
  for (const email of expectedEmails) {
    const status = ikByEmail.get(email.toLowerCase()) ?? "unknown"
    byStatus[status] = (byStatus[status] ?? 0) + 1
  }

  // 5. Determine how many domains are fully ready (both mailboxes active)
  let domainsReady = 0
  for (const domain of selectedDomains) {
    const persona = PERSONA_NAMES[domain.persona] ?? PERSONA_NAMES.josh
    const email1 = `${persona.first}@${domain.name}`.toLowerCase()
    const email2 = `${persona.first}.${persona.last}@${domain.name}`.toLowerCase()
    const status1 = ikByEmail.get(email1)
    const status2 = ikByEmail.get(email2)
    if (status1 === "active" && status2 === "active") {
      domainsReady++
    }
  }

  // 6. Check how many expected emails are already synced to Supabase (mailbox_accounts)
  const { count: exportedCount } = await supabase
    .from("mailbox_accounts")
    .select("id", { count: "exact", head: true })
    .in("email", expectedEmails)

  return NextResponse.json({
    total_mailboxes: expectedEmails.length,
    by_status: byStatus,
    domains_ready: domainsReady,
    domains_total: selectedDomains.length,
    exported_to_smartlead: exportedCount ?? 0,
  })
}
