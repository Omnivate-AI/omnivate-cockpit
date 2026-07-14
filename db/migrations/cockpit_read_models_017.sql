-- cockpit_read_models_017 — V2 Phase 3 (audit RC-4/RC-6/RC-9/RC-10 + small view fixes)
-- Source: docs/V2-AUDIT-FINDINGS.md (2026-07-14). Applied live via Management API 2026-07-14.
--
-- 1. Capacity/limit reads switch to the Smartlead-synced daily_send_limit (RC-6):
--    sp_mailboxes.max_email_per_day is the email-infra engine's intent column and the
--    weekly rotation didn't maintain it (fixed engine-side in email-infra PR #1, data
--    corrected 2026-07-14) — the synced column is the belt-and-braces truth for display.
--    COALESCE keeps a fallback for boxes never synced from Smartlead.
-- 2. vw_cockpit_client_health_summary counts real 'draining' boxes (was hardcoded 0 —
--    Cylindo's 2 draining boxes made category counts not sum to total).
-- 3. vw_cockpit_interested_leads rebuilt on the CANONICAL positive-reply source
--    (RC-9 + RC-10, decision #1): sp_campaign_leads current category ∈
--    {Interested, human_action_required} — Smartlead's own UI-matching state, including
--    pre-webhook history (Cylindo: 38 webhook-era rows vs ~95 real positives) — with
--    campaign_lead_map_id (the id the master-inbox ?leadMap= deep-link actually needs;
--    lead-id links were 26/26 dead) and lead_category_name exposed. date_converted =
--    latest captured reply timestamp, falling back to category_synced_at.
-- 4. cockpit_interested_leads snapshot table + fn carry the two new columns.
-- 5. client_analytics_config.acceleration_partners.is_active corrected to true (latent:
--    the app keys activity off sp_clients.active, but the stale flag would bite anything
--    that trusts the config table).

-- ---------------------------------------------------------------------------
-- 1a. vw_cockpit_accounts — Daily Limit reads the synced cap
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_cockpit_accounts AS
 SELECT m.id,
    m.smartlead_account_id,
    m.email,
    m.client,
    m.domain_id,
    m.domain_name,
    m.persona,
    m.lifecycle_status,
    m.platform,
    m.provider_canonical,
    m.warmup_reputation_pct AS warmup_health_pct,
    COALESCE(m.daily_send_limit, m.max_email_per_day) AS max_email_per_day,
    COALESCE(m.is_master_inbox, false) AS is_master_inbox,
        CASE
            WHEN jsonb_typeof(m.tags) = 'array'::text THEN COALESCE(( SELECT array_agg(COALESCE(t.value ->> 'tag_name'::text, TRIM(BOTH '"'::text FROM t.value::text))) AS array_agg
               FROM jsonb_array_elements(m.tags) t(value)), '{}'::text[])
            ELSE '{}'::text[]
        END AS smartlead_tags,
    COALESCE(m.is_blocked, false) AS is_warmup_blocked,
    m.health_checked_at,
    m.warmup_status,
    m.mailbox_group,
    m.status,
    m.created_at,
    m.updated_at,
    COALESCE(r.campaign_ids, '{}'::bigint[]) AS campaign_ids
   FROM vw_sp_mailboxes m
     LEFT JOIN LATERAL ( SELECT array_agg(DISTINCT c.smartlead_campaign_id) AS campaign_ids
           FROM sp_campaign_mailbox_roster cr
             JOIN sp_campaigns c ON c.id = cr.campaign_id
          WHERE cr.mailbox_id = m.id AND cr.detached_at IS NULL) r ON true;

-- ---------------------------------------------------------------------------
-- 1b. vw_cockpit_client_capacity — capacity from the synced cap
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_cockpit_client_capacity AS
 SELECT client,
    COALESCE(sum(COALESCE(daily_send_limit, max_email_per_day)) FILTER (WHERE lifecycle_status = 'active'::text AND NOT COALESCE(is_master_inbox, false)), 0::bigint)::integer AS active_daily_capacity,
    COALESCE(sum(COALESCE(daily_send_limit, max_email_per_day)) FILTER (WHERE (lifecycle_status = ANY (ARRAY['active'::text, 'reserve'::text, 'warming'::text, 'resting'::text])) AND NOT COALESCE(is_master_inbox, false)), 0::bigint)::integer AS total_send_capacity,
    count(*) FILTER (WHERE lifecycle_status = ANY (ARRAY['burnt'::text, 'parked'::text]))::integer AS out_of_service_count
   FROM vw_sp_mailboxes m
  WHERE client IS NOT NULL
  GROUP BY client;

-- ---------------------------------------------------------------------------
-- 1c. vw_cockpit_rotation_capacity — group capacities from the synced cap
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_cockpit_rotation_capacity AS
 SELECT client,
    count(*) FILTER (WHERE mailbox_group = 'A'::text) AS group_a_boxes,
    COALESCE(sum(COALESCE(daily_send_limit, max_email_per_day)) FILTER (WHERE mailbox_group = 'A'::text), 0::bigint)::integer AS group_a_capacity,
    count(*) FILTER (WHERE mailbox_group = 'A'::text AND lifecycle_status = 'active'::text) AS group_a_active_boxes,
    count(*) FILTER (WHERE mailbox_group = 'B'::text) AS group_b_boxes,
    COALESCE(sum(COALESCE(daily_send_limit, max_email_per_day)) FILTER (WHERE mailbox_group = 'B'::text), 0::bigint)::integer AS group_b_capacity,
    count(*) FILTER (WHERE mailbox_group = 'B'::text AND lifecycle_status = 'active'::text) AS group_b_active_boxes,
    count(*) FILTER (WHERE lifecycle_status = ANY (ARRAY['active'::text, 'resting'::text])) AS pool_boxes,
    COALESCE(sum(COALESCE(daily_send_limit, max_email_per_day)) FILTER (WHERE lifecycle_status = ANY (ARRAY['active'::text, 'resting'::text])), 0::bigint)::integer AS pool_capacity,
    count(*) FILTER (WHERE lifecycle_status = 'reserve'::text) AS reserve_boxes,
    COALESCE(sum(COALESCE(daily_send_limit, max_email_per_day)) FILTER (WHERE lifecycle_status = 'reserve'::text), 0::bigint)::integer AS reserve_capacity,
    count(*) FILTER (WHERE lifecycle_status = 'warming'::text) AS warming_boxes,
    count(*) FILTER (WHERE mailbox_group IS NULL AND (lifecycle_status = ANY (ARRAY['active'::text, 'resting'::text]))) AS ungrouped_pool_boxes
   FROM sp_mailboxes
  WHERE (lifecycle_status <> ALL (ARRAY['retired'::text, 'parked'::text])) AND NOT COALESCE(is_master_inbox, false)
  GROUP BY client;

-- ---------------------------------------------------------------------------
-- 2. vw_cockpit_client_health_summary — real draining count
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_cockpit_client_health_summary AS
 SELECT client,
    count(*) FILTER (WHERE lifecycle_status = 'active'::text AND NOT COALESCE(is_master_inbox, false))::integer AS active,
    0 AS ramping,
    count(*) FILTER (WHERE lifecycle_status = 'warming'::text)::integer AS warming,
    count(*) FILTER (WHERE lifecycle_status = 'reserve'::text)::integer AS reserve,
    count(*) FILTER (WHERE lifecycle_status = 'resting'::text)::integer AS resting,
    count(*) FILTER (WHERE lifecycle_status = 'parked'::text)::integer AS parked,
    count(*) FILTER (WHERE lifecycle_status = 'burnt'::text)::integer AS burnt,
    count(*) FILTER (WHERE lifecycle_status = 'draining'::text)::integer AS draining,
    count(*) FILTER (WHERE lifecycle_status = 'retired'::text)::integer AS retired,
    count(*) FILTER (WHERE lifecycle_status = 'master'::text OR COALESCE(is_master_inbox, false))::integer AS masters,
    count(*)::integer AS total,
    avg(warmup_reputation_pct) FILTER (WHERE lifecycle_status = 'active'::text) AS avg_sending_health
   FROM vw_sp_mailboxes m
  WHERE client IS NOT NULL
  GROUP BY client;

-- ---------------------------------------------------------------------------
-- 3. vw_cockpit_interested_leads — canonical positive-reply source + map ids
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_cockpit_interested_leads AS
( SELECT DISTINCT ON ((lower(cl2.lead_email))) 'cylindo'::text AS client,
    COALESCE(r.last_reply_at, cl2.category_synced_at) AS date_converted,
    cl2.lead_email AS replier_email,
    cl2.smartlead_lead_id::text AS smartlead_lead_id,
    COALESCE(l.full_name, NULLIF(TRIM(BOTH FROM COALESCE(cl2.first_name, '') || ' ' || COALESCE(cl2.last_name, '')), '')) AS full_name,
    COALESCE(l.company_name, cl2.company_name) AS company_name,
    l.title,
    l.mobile_phone AS phone,
    l.linkedin_url,
    l.company_linkedin_url,
    COALESCE(l.company_website, l.company_domain) AS website,
    l.industry,
    l.call_brief_pdf_url,
    NULL::text AS sendspark_video_url,
    cl2.campaign_lead_map_id::text AS campaign_lead_map_id,
    cl2.lead_category_name
   FROM sp_campaign_leads cl2
     JOIN sp_campaigns c ON c.id = cl2.campaign_id
     JOIN sp_clients s ON s.id = c.client_id AND s.slug = 'cylindo'::text
     LEFT JOIN LATERAL ( SELECT max(r2.received_at) AS last_reply_at
           FROM sp_replies r2 WHERE lower(r2.replier_email) = lower(cl2.lead_email)) r ON true
     LEFT JOIN cylindo_leads l ON lower(l.email) = lower(cl2.lead_email)
  WHERE cl2.lead_category_name = ANY (ARRAY['Interested'::text, 'human_action_required'::text])
  ORDER BY (lower(cl2.lead_email)), (cl2.campaign_lead_map_id IS NULL), COALESCE(r.last_reply_at, cl2.category_synced_at) DESC)
UNION ALL
( SELECT DISTINCT ON ((lower(cl2.lead_email))) 'paycaptain'::text AS client,
    COALESCE(r.last_reply_at, cl2.category_synced_at) AS date_converted,
    cl2.lead_email AS replier_email,
    cl2.smartlead_lead_id::text AS smartlead_lead_id,
    COALESCE(l.full_name, NULLIF(TRIM(BOTH FROM COALESCE(cl2.first_name, '') || ' ' || COALESCE(cl2.last_name, '')), '')) AS full_name,
    COALESCE(l.company_name, cl2.company_name) AS company_name,
    l.title,
    l.mobile_phone AS phone,
    l.linkedin_url,
    l.company_linkedin_url,
    COALESCE(l.company_website, l.company_domain) AS website,
    l.industry,
    l.call_brief_pdf_url,
    l.sendspark_video_url,
    cl2.campaign_lead_map_id::text AS campaign_lead_map_id,
    cl2.lead_category_name
   FROM sp_campaign_leads cl2
     JOIN sp_campaigns c ON c.id = cl2.campaign_id
     JOIN sp_clients s ON s.id = c.client_id AND s.slug = 'paycaptain'::text
     LEFT JOIN LATERAL ( SELECT max(r2.received_at) AS last_reply_at
           FROM sp_replies r2 WHERE lower(r2.replier_email) = lower(cl2.lead_email)) r ON true
     LEFT JOIN paycaptain_leads l ON lower(l.email) = lower(cl2.lead_email)
  WHERE cl2.lead_category_name = ANY (ARRAY['Interested'::text, 'human_action_required'::text])
  ORDER BY (lower(cl2.lead_email)), (cl2.campaign_lead_map_id IS NULL), COALESCE(r.last_reply_at, cl2.category_synced_at) DESC)
UNION ALL
( SELECT DISTINCT ON ((lower(cl2.lead_email))) 'acceleration_partners'::text AS client,
    COALESCE(r.last_reply_at, cl2.category_synced_at) AS date_converted,
    cl2.lead_email AS replier_email,
    cl2.smartlead_lead_id::text AS smartlead_lead_id,
    COALESCE(l.full_name, NULLIF(TRIM(BOTH FROM COALESCE(cl2.first_name, '') || ' ' || COALESCE(cl2.last_name, '')), '')) AS full_name,
    COALESCE(l.company_name, cl2.company_name) AS company_name,
    l.title,
    l.mobile_phone AS phone,
    l.linkedin_url,
    l.company_linkedin_url,
    COALESCE(l.company_website, l.company_domain) AS website,
    l.industry,
    NULL::text AS call_brief_pdf_url,
    NULL::text AS sendspark_video_url,
    cl2.campaign_lead_map_id::text AS campaign_lead_map_id,
    cl2.lead_category_name
   FROM sp_campaign_leads cl2
     JOIN sp_campaigns c ON c.id = cl2.campaign_id
     JOIN sp_clients s ON s.id = c.client_id AND s.slug = 'acceleration_partners'::text
     LEFT JOIN LATERAL ( SELECT max(r2.received_at) AS last_reply_at
           FROM sp_replies r2 WHERE lower(r2.replier_email) = lower(cl2.lead_email)) r ON true
     LEFT JOIN acceleration_partners_leads l ON lower(l.email) = lower(cl2.lead_email)
  WHERE cl2.lead_category_name = ANY (ARRAY['Interested'::text, 'human_action_required'::text])
  ORDER BY (lower(cl2.lead_email)), (cl2.campaign_lead_map_id IS NULL), COALESCE(r.last_reply_at, cl2.category_synced_at) DESC)
UNION ALL
( SELECT DISTINCT ON ((lower(cl2.lead_email))) 'omnivate'::text AS client,
    COALESCE(r.last_reply_at, cl2.category_synced_at) AS date_converted,
    cl2.lead_email AS replier_email,
    cl2.smartlead_lead_id::text AS smartlead_lead_id,
    COALESCE(l.full_name, NULLIF(TRIM(BOTH FROM COALESCE(cl2.first_name, '') || ' ' || COALESCE(cl2.last_name, '')), '')) AS full_name,
    COALESCE(l.company_name, cl2.company_name) AS company_name,
    l.title,
    l.mobile_phone AS phone,
    l.linkedin_url,
    l.company_linkedin_url,
    COALESCE(l.company_website, l.company_domain) AS website,
    NULL::text AS industry,
    NULL::text AS call_brief_pdf_url,
    NULL::text AS sendspark_video_url,
    cl2.campaign_lead_map_id::text AS campaign_lead_map_id,
    cl2.lead_category_name
   FROM sp_campaign_leads cl2
     JOIN sp_campaigns c ON c.id = cl2.campaign_id
     JOIN sp_clients s ON s.id = c.client_id AND s.slug = 'omnivate'::text
     LEFT JOIN LATERAL ( SELECT max(r2.received_at) AS last_reply_at
           FROM sp_replies r2 WHERE lower(r2.replier_email) = lower(cl2.lead_email)) r ON true
     LEFT JOIN omnivate_leads l ON lower(l.email) = lower(cl2.lead_email)
  WHERE cl2.lead_category_name = ANY (ARRAY['Interested'::text, 'human_action_required'::text])
  ORDER BY (lower(cl2.lead_email)), (cl2.campaign_lead_map_id IS NULL), COALESCE(r.last_reply_at, cl2.category_synced_at) DESC);

-- ---------------------------------------------------------------------------
-- 4. Snapshot table + refresh fn carry the new columns
-- ---------------------------------------------------------------------------
ALTER TABLE cockpit_interested_leads
  ADD COLUMN IF NOT EXISTS campaign_lead_map_id text,
  ADD COLUMN IF NOT EXISTS lead_category_name text;

CREATE OR REPLACE FUNCTION public.fn_cockpit_snapshot_interested_leads()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  TRUNCATE public.cockpit_interested_leads;
  INSERT INTO public.cockpit_interested_leads
    (client, date_converted, replier_email, smartlead_lead_id, full_name,
     company_name, title, phone, linkedin_url, company_linkedin_url, website,
     industry, call_brief_pdf_url, sendspark_video_url,
     campaign_lead_map_id, lead_category_name, snapshot_at)
  SELECT client, date_converted, replier_email, smartlead_lead_id, full_name,
     company_name, title, phone, linkedin_url, company_linkedin_url, website,
     industry, call_brief_pdf_url, sendspark_video_url,
     campaign_lead_map_id, lead_category_name, now()
  FROM public.vw_cockpit_interested_leads;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Config correction (latent flag drift found by the audit)
-- ---------------------------------------------------------------------------
UPDATE client_analytics_config SET is_active = true
 WHERE client = 'acceleration_partners' AND is_active = false;
