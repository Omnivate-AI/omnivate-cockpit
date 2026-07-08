-- =============================================================
-- cockpit_read_models_013 - Interested Leads (Omar 2026-07-08:
-- "a tab for each client showing the leads that have come through — all
-- interested leads... only bring in the info on the leads not the SDR
-- calling columns... as the perf plugin updates interested replies in
-- Supabase they should appear in the software.")
-- Decision (Omar 07-08 18:41): Supabase columns only, no Intent / no call
-- attempts, email replies only.
-- =============================================================
-- SOURCE OF TRUTH = sp_replies WHERE lead_category_name='Interested' (the
-- perf plugin writes it, uniform across every client — unlike the lead
-- tables' reply_category, which exists on cylindo/paycaptain but NOT
-- acceleration_partners/omnivate). Lead detail is joined per-client from
-- {client}_leads, selecting only the columns that table actually has
-- (schema drift is real — see the per-branch NULLs):
--   * omnivate_leads has NO smartlead_lead_id and NO industry
--   * acceleration_partners/omnivate have NO call_brief; only paycaptain
--     has sendspark_video_url
-- Join: sp_replies.smartlead_lead_id -> {client}_leads.smartlead_lead_id,
-- falling back to email (LATERAL LIMIT 1, lead-id match preferred). The
-- Smartlead conversation link is built app-side from smartlead_lead_id.
-- Deduped to one row per interested lead (latest reply).
-- Small (61 rows total today) -> live view, no snapshot needed.
-- Rollback: DROP VIEW IF EXISTS public.vw_cockpit_interested_leads;
-- =============================================================

CREATE OR REPLACE VIEW public.vw_cockpit_interested_leads AS
WITH interested AS (
  -- cylindo: full detail incl. call brief
  SELECT 'cylindo'::text AS client, r.received_at AS date_converted,
    r.replier_email, r.smartlead_lead_id::text AS smartlead_lead_id,
    l.full_name, l.company_name, l.title, l.mobile_phone AS phone,
    l.linkedin_url, l.company_linkedin_url,
    COALESCE(l.company_website, l.company_domain) AS website,
    l.industry, l.call_brief_pdf_url, NULL::text AS sendspark_video_url
  FROM sp_replies r
  JOIN sp_mailboxes m ON m.id = r.mailbox_id AND m.client = 'cylindo'
  LEFT JOIN LATERAL (
    SELECT * FROM cylindo_leads cl
    WHERE cl.smartlead_lead_id::text = r.smartlead_lead_id::text
       OR lower(cl.email) = lower(r.replier_email)
    ORDER BY (cl.smartlead_lead_id::text = r.smartlead_lead_id::text) DESC NULLS LAST
    LIMIT 1
  ) l ON true
  WHERE r.lead_category_name = 'Interested'

  UNION ALL
  -- paycaptain: call brief + sendspark video; NO smartlead_lead_id col -> email join
  SELECT 'paycaptain', r.received_at,
    r.replier_email, r.smartlead_lead_id::text,
    l.full_name, l.company_name, l.title, l.mobile_phone,
    l.linkedin_url, l.company_linkedin_url,
    COALESCE(l.company_website, l.company_domain),
    l.industry, l.call_brief_pdf_url, l.sendspark_video_url
  FROM sp_replies r
  JOIN sp_mailboxes m ON m.id = r.mailbox_id AND m.client = 'paycaptain'
  LEFT JOIN LATERAL (
    SELECT * FROM paycaptain_leads cl
    WHERE lower(cl.email) = lower(r.replier_email)
    LIMIT 1
  ) l ON true
  WHERE r.lead_category_name = 'Interested'

  UNION ALL
  -- acceleration_partners: no call brief, no sendspark
  SELECT 'acceleration_partners', r.received_at,
    r.replier_email, r.smartlead_lead_id::text,
    l.full_name, l.company_name, l.title, l.mobile_phone,
    l.linkedin_url, l.company_linkedin_url,
    COALESCE(l.company_website, l.company_domain),
    l.industry, NULL::text, NULL::text
  FROM sp_replies r
  JOIN sp_mailboxes m ON m.id = r.mailbox_id AND m.client = 'acceleration_partners'
  LEFT JOIN LATERAL (
    SELECT * FROM acceleration_partners_leads cl
    WHERE cl.smartlead_lead_id::text = r.smartlead_lead_id::text
       OR lower(cl.email) = lower(r.replier_email)
    ORDER BY (cl.smartlead_lead_id::text = r.smartlead_lead_id::text) DESC NULLS LAST
    LIMIT 1
  ) l ON true
  WHERE r.lead_category_name = 'Interested'

  UNION ALL
  -- omnivate: no smartlead_lead_id, no industry, no assets -> email join only
  SELECT 'omnivate', r.received_at,
    r.replier_email, r.smartlead_lead_id::text,
    l.full_name, l.company_name, l.title, l.mobile_phone,
    l.linkedin_url, l.company_linkedin_url,
    COALESCE(l.company_website, l.company_domain),
    NULL::text, NULL::text, NULL::text
  FROM sp_replies r
  JOIN sp_mailboxes m ON m.id = r.mailbox_id AND m.client = 'omnivate'
  LEFT JOIN LATERAL (
    SELECT * FROM omnivate_leads cl
    WHERE lower(cl.email) = lower(r.replier_email)
    LIMIT 1
  ) l ON true
  WHERE r.lead_category_name = 'Interested'
)
SELECT DISTINCT ON (client, lower(replier_email))
  client, date_converted, replier_email, smartlead_lead_id,
  full_name, company_name, title, phone, linkedin_url,
  company_linkedin_url, website, industry, call_brief_pdf_url, sendspark_video_url
FROM interested
ORDER BY client, lower(replier_email), date_converted DESC;
