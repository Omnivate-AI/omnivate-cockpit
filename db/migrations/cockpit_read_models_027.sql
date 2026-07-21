-- cockpit_read_models_027 — V5: primary-scoped inputs for the efficiency ratios
-- Applied live via Supabase Management API on 2026-07-21.
--
-- Why (Omar's V4 review, AP example): the client-level ratios divided ALL
-- campaign sends/contacts (including follow-up + referral campaigns) by ALL
-- positives. Follow-up/referral sends happen AFTER a positive reply — counting
-- them distorts "how much outreach buys one positive". The ratios now read
-- primary campaigns only, both numerator and denominator (same precedent as
-- vw_cockpit_client_runway, migration 007). Totals cards stay all-campaign.

-- 1) Per-class daily perf (client × day × class) — the ratio cards sum
--    class='primary'; unclassified campaigns default to primary.
CREATE OR REPLACE VIEW vw_cockpit_daily_client_class_perf AS
SELECT cl.slug AS client,
       f.date AS snapshot_date,
       COALESCE(cc.campaign_class, 'primary') AS campaign_class,
       sum(f.emails_sent) AS emails_sent_count,
       sum(f.replies) AS reply_count,
       sum(f.positive_replies) AS positive_replies_count
FROM sp_daily_campaign_facts f
JOIN sp_campaigns c ON c.id = f.campaign_id
JOIN sp_clients cl ON cl.id = c.client_id
LEFT JOIN vw_cockpit_campaign_class cc ON cc.id = c.id
GROUP BY 1, 2, 3;

-- 2) Distinct contacts emailed by PRIMARY campaigns only (same contract as
--    cockpit_contacts_emailed, which stays for compatibility).
CREATE OR REPLACE FUNCTION public.cockpit_contacts_emailed_primary(p_start date, p_end date)
RETURNS TABLE(client text, contacts_emailed bigint)
LANGUAGE sql
STABLE
AS $function$
  select cl.slug as client,
         count(distinct e.smartlead_lead_id) as contacts_emailed
  from sp_send_events e
  join sp_clients cl on cl.id = e.client_id
  left join sp_campaigns c on c.smartlead_campaign_id = e.smartlead_campaign_id
  left join vw_cockpit_campaign_class cc on cc.id = c.id
  where e.sent_at >= (p_start::timestamp at time zone 'UTC')
    and e.sent_at <  ((p_end + 1)::timestamp at time zone 'UTC')
    and e.smartlead_lead_id is not null
    and coalesce(cc.campaign_class, 'primary') = 'primary'
  group by cl.slug;
$function$;
