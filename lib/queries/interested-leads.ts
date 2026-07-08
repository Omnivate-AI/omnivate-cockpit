import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import { resolveClientSlugs } from "@/lib/queries/clients"

// Interested Leads (Omar 2026-07-08) — the positive email replies per client.
// Source: vw_cockpit_interested_leads (migration 013) = sp_replies category
// 'Interested' (perf-plugin-fed, uniform across clients) joined to the
// per-client lead table for detail. Supabase columns only — no Intent / no
// SDR calling columns (Omar 07-08). Auto-updates as the perf plugin
// categorises new replies. Small (tens of rows) — live view, no snapshot.

export interface InterestedLead {
  client: string
  date_converted: string | null
  replier_email: string
  smartlead_lead_id: string | null
  full_name: string | null
  company_name: string | null
  title: string | null
  phone: string | null
  linkedin_url: string | null
  company_linkedin_url: string | null
  website: string | null
  industry: string | null
  call_brief_pdf_url: string | null
  sendspark_video_url: string | null
}

export const getClientInterestedLeads = cache(
  async (client: string): Promise<InterestedLead[]> => {
    const supabase = createServerClient()
    const slugs = await resolveClientSlugs(client)

    const { data } = await supabase
      .from("vw_cockpit_interested_leads")
      .select("*")
      .in("client", slugs)
      .order("date_converted", { ascending: false, nullsFirst: false })

    return (data ?? []) as InterestedLead[]
  }
)
