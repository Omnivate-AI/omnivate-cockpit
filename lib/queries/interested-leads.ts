import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import { resolveClientSlugs } from "@/lib/queries/clients"

// Interested Leads (Omar 2026-07-08) — the positive email replies per client.
// Reads cockpit_interested_leads, a small table refreshed daily (09:14 UTC)
// by fn_cockpit_snapshot_interested_leads from vw_cockpit_interested_leads
// (= sp_replies category 'Interested', perf-fed + uniform across clients,
// joined per-client to the lead table). Materialized because the live view
// is 6-8s/client (lower(email) scan over 90k-260k lead rows) — migration
// 013/014/015. Supabase columns only, no Intent / no SDR calling (Omar
// 07-08). Daily cadence matches the app's 24h freshness bar.

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
      .from("cockpit_interested_leads")
      .select("*")
      .in("client", slugs)
      .order("date_converted", { ascending: false, nullsFirst: false })

    return (data ?? []) as InterestedLead[]
  }
)
