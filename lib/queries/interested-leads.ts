import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import { resolveClientSlugs } from "@/lib/queries/clients"

// Positive replies (Omar 2026-07-08; definition per decision #1 2026-07-12) —
// per-client leads whose CURRENT Smartlead category is Interested or
// human_action_required. Reads cockpit_interested_leads, a small table
// refreshed daily (09:14 UTC) by fn_cockpit_snapshot_interested_leads from
// vw_cockpit_interested_leads. Since migration 017 (V2 Phase 3) the view's
// source is sp_campaign_leads current category — Smartlead's own UI-matching
// state including pre-webhook history (RC-10: the old sp_replies source
// undercounted Cylindo ~60%) — joined per-client to the lead table, with
// campaign_lead_map_id for the conversation deep-link (RC-9: the ?leadMap=
// URL param needs the association id, NOT the lead id — lead-id links were
// 26/26 dead). Materialized because the live view scans 90k-260k lead rows.

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
  /** Smartlead campaign↔lead association id — what ?leadMap= filters on.
      Null until the category capture has stored it; render NO link then. */
  campaign_lead_map_id: string | null
  /** 'Interested' | 'human_action_required' — keeps the combined
      "Positive replies" definition visible per row. */
  lead_category_name: string | null
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
