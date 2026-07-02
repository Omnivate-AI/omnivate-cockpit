import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

/**
 * GET /api/domains/{domain_name}/preflight?client=orbitalx
 *
 * Fetches fresh billing data from InboxKit for a domain's mailboxes.
 * The [id] param is actually the domain_name (matching existing route convention).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: domain_name } = await params
  const client = req.nextUrl.searchParams.get("client")
  if (!client) {
    return NextResponse.json({ error: "client query param required" }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data: domain } = await supabase
    .from("mailbox_domains")
    .select("inboxkit_workspace_uid, provider")
    .eq("domain_name", domain_name)
    .eq("client", client)
    .maybeSingle()

  const { data: accounts } = await supabase
    .from("mailbox_accounts")
    .select("email, prepaid_until, renewal_cycle, renewal_date, inboxkit_mailbox_uid, provider, warmup_health_pct")
    .eq("domain_name", domain_name)
    .eq("client", client)
    .eq("is_master_inbox", false)

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ error: "No mailboxes found" }, { status: 404 })
  }

  const now = new Date()
  type MailboxPreflight = {
    email: string
    prepaid_until: string | null
    days_remaining: number | null
    renewal_cycle: string | null
    provider: string
    health: number | null
    warning: string | null
  }

  // Try fetching fresh data from InboxKit
  const freshData = new Map<string, { prepaid_until: string; renewal_cycle: string }>()
  if (domain?.inboxkit_workspace_uid && domain?.provider === "inboxkit") {
    try {
      const ikKey = process.env.INBOXKIT_API_KEY
      let page = 1
      while (true) {
        const res = await fetch("https://api.inboxkit.com/v1/api/mailboxes/list", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ikKey}`,
            "X-Workspace-Id": domain.inboxkit_workspace_uid,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ limit: 200, page }),
        })
        if (!res.ok) break
        const data = await res.json()
        for (const mb of data.mailboxes ?? []) {
          if (mb.domain_name === domain_name) {
            const email = `${mb.username}@${mb.domain_name}`.toLowerCase()
            freshData.set(email, {
              prepaid_until: mb.prepaid_until ?? null,
              renewal_cycle: mb.renewal_cycle ?? null,
            })
          }
        }
        if (page >= (data.pages ?? 1)) break
        page++
      }
    } catch { /* fall back to cached */ }
  }

  const result: MailboxPreflight[] = accounts.map((acc) => {
    const fresh = freshData.get(acc.email?.toLowerCase())
    const prepaidRaw = fresh?.prepaid_until ?? acc.prepaid_until
    const prepaidDate = prepaidRaw ? new Date(prepaidRaw) : null
    const daysRemaining = prepaidDate ? Math.ceil((prepaidDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null

    let warning: string | null = null
    if (daysRemaining !== null) {
      if (daysRemaining < 0) warning = "Expired"
      else if (daysRemaining < 7) warning = `Expires in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}`
    }

    if (fresh) {
      supabase.from("mailbox_accounts").update({
        prepaid_until: fresh.prepaid_until,
        renewal_cycle: fresh.renewal_cycle,
      }).eq("email", acc.email).then(() => {})
    }

    return {
      email: acc.email,
      prepaid_until: prepaidRaw,
      days_remaining: daysRemaining,
      renewal_cycle: fresh?.renewal_cycle ?? acc.renewal_cycle,
      provider: acc.provider ?? "inboxkit",
      health: acc.warmup_health_pct,
      warning,
    }
  })

  const masterEmail = await supabase
    .from("mailbox_clients")
    .select("master_email")
    .eq("slug", client)
    .maybeSingle()

  return NextResponse.json({
    domain: domain_name,
    client,
    provider: domain?.provider ?? "inboxkit",
    master_email: masterEmail?.data?.master_email ?? null,
    mailboxes: result,
  })
}
