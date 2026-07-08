-- =============================================================
-- cockpit_read_models_014 - make vw_cockpit_interested_leads FAST.
-- =============================================================
-- 013 used a per-row LATERAL lookup into {client}_leads (90k-260k rows,
-- no index on smartlead_lead_id/email) -> ~28 seq scans per client ->
-- 8-11s even client-filtered, tripping PostgREST's statement timeout (the
-- tab would render blank on prod). Rewrite as a single hash-joinable
-- equi-join on lower(email): each lead table is scanned ONCE and probed
-- against the ~tens of interested replies. Email is the natural key (the
-- SDR trackers match on it too); we drop the lead-id-only fallback, so a
-- reply whose replier email doesn't match a lead still shows (email +
-- Smartlead link), just without enriched detail — same as before.
-- DISTINCT ON (lower(email)) per client branch keeps one row per lead
-- (latest reply). Client filter prunes to a single branch (constant
-- output column on UNION ALL).
-- Rollback: restore the 013 body.
-- =============================================================

CREATE OR REPLACE VIEW public.vw_cockpit_interested_leads AS
(
  SELECT DISTINCT ON (lower(r.replier_email))
    'cylindo'::text AS client, r.received_at AS date_converted,
    r.replier_email, r.smartlead_lead_id::text AS smartlead_lead_id,
    l.full_name, l.company_name, l.title, l.mobile_phone AS phone,
    l.linkedin_url, l.company_linkedin_url,
    COALESCE(l.company_website, l.company_domain) AS website,
    l.industry, l.call_brief_pdf_url, NULL::text AS sendspark_video_url
  FROM sp_replies r
  JOIN sp_mailboxes m ON m.id = r.mailbox_id AND m.client = 'cylindo'
  LEFT JOIN cylindo_leads l ON lower(l.email) = lower(r.replier_email)
  WHERE r.lead_category_name = 'Interested'
  ORDER BY lower(r.replier_email), r.received_at DESC
)
UNION ALL
(
  SELECT DISTINCT ON (lower(r.replier_email))
    'paycaptain', r.received_at,
    r.replier_email, r.smartlead_lead_id::text,
    l.full_name, l.company_name, l.title, l.mobile_phone,
    l.linkedin_url, l.company_linkedin_url,
    COALESCE(l.company_website, l.company_domain),
    l.industry, l.call_brief_pdf_url, l.sendspark_video_url
  FROM sp_replies r
  JOIN sp_mailboxes m ON m.id = r.mailbox_id AND m.client = 'paycaptain'
  LEFT JOIN paycaptain_leads l ON lower(l.email) = lower(r.replier_email)
  WHERE r.lead_category_name = 'Interested'
  ORDER BY lower(r.replier_email), r.received_at DESC
)
UNION ALL
(
  SELECT DISTINCT ON (lower(r.replier_email))
    'acceleration_partners', r.received_at,
    r.replier_email, r.smartlead_lead_id::text,
    l.full_name, l.company_name, l.title, l.mobile_phone,
    l.linkedin_url, l.company_linkedin_url,
    COALESCE(l.company_website, l.company_domain),
    l.industry, NULL::text, NULL::text
  FROM sp_replies r
  JOIN sp_mailboxes m ON m.id = r.mailbox_id AND m.client = 'acceleration_partners'
  LEFT JOIN acceleration_partners_leads l ON lower(l.email) = lower(r.replier_email)
  WHERE r.lead_category_name = 'Interested'
  ORDER BY lower(r.replier_email), r.received_at DESC
)
UNION ALL
(
  SELECT DISTINCT ON (lower(r.replier_email))
    'omnivate', r.received_at,
    r.replier_email, r.smartlead_lead_id::text,
    l.full_name, l.company_name, l.title, l.mobile_phone,
    l.linkedin_url, l.company_linkedin_url,
    COALESCE(l.company_website, l.company_domain),
    NULL::text, NULL::text, NULL::text
  FROM sp_replies r
  JOIN sp_mailboxes m ON m.id = r.mailbox_id AND m.client = 'omnivate'
  LEFT JOIN omnivate_leads l ON lower(l.email) = lower(r.replier_email)
  WHERE r.lead_category_name = 'Interested'
  ORDER BY lower(r.replier_email), r.received_at DESC
);
