-- V3 F4 — "Became interested" date fix.
--
-- date_converted was COALESCE(max(reply.received_at), category_synced_at): when
-- a lead's reply was never captured (pre-webhook history, ~60% of Cylindo's
-- interested leads), it fell back to the SYNC timestamp — so recent rows all
-- read the same ingestion time, which is what Omar flagged as wrong.
--
-- Fix: date_converted = the FIRST captured reply (min received_at) = when the
-- lead actually became a positive reply; NULL when we never captured the reply
-- (honest "—" in the UI) instead of a fake sync date. Only the date expression,
-- the LATERAL aggregate (max→min), and the tiebreak ORDER BY change; every
-- column/shape stays identical so the snapshot function is unaffected.

create or replace view vw_cockpit_interested_leads as
( select distinct on (lower(cl2.lead_email)) 'cylindo'::text as client,
    r.first_reply_at as date_converted,
    cl2.lead_email as replier_email,
    cl2.smartlead_lead_id::text as smartlead_lead_id,
    coalesce(l.full_name, nullif(trim(both from (coalesce(cl2.first_name, ''::text) || ' '::text) || coalesce(cl2.last_name, ''::text)), ''::text)) as full_name,
    coalesce(l.company_name, cl2.company_name) as company_name,
    l.title,
    l.mobile_phone as phone,
    l.linkedin_url,
    l.company_linkedin_url,
    coalesce(l.company_website, l.company_domain) as website,
    l.industry,
    l.call_brief_pdf_url,
    null::text as sendspark_video_url,
    cl2.campaign_lead_map_id::text as campaign_lead_map_id,
    cl2.lead_category_name
   from sp_campaign_leads cl2
     join sp_campaigns c on c.id = cl2.campaign_id
     join sp_clients s on s.id = c.client_id and s.slug = 'cylindo'::text
     left join lateral ( select min(r2.received_at) as first_reply_at
           from sp_replies r2
          where lower(r2.replier_email) = lower(cl2.lead_email)) r on true
     left join cylindo_leads l on lower(l.email) = lower(cl2.lead_email)
  where cl2.lead_category_name = any (array['Interested'::text, 'human_action_required'::text])
  order by (lower(cl2.lead_email)), (cl2.campaign_lead_map_id is null), r.first_reply_at desc nulls last)
union all
( select distinct on (lower(cl2.lead_email)) 'paycaptain'::text as client,
    r.first_reply_at as date_converted,
    cl2.lead_email as replier_email,
    cl2.smartlead_lead_id::text as smartlead_lead_id,
    coalesce(l.full_name, nullif(trim(both from (coalesce(cl2.first_name, ''::text) || ' '::text) || coalesce(cl2.last_name, ''::text)), ''::text)) as full_name,
    coalesce(l.company_name, cl2.company_name) as company_name,
    l.title,
    l.mobile_phone as phone,
    l.linkedin_url,
    l.company_linkedin_url,
    coalesce(l.company_website, l.company_domain) as website,
    l.industry,
    l.call_brief_pdf_url,
    l.sendspark_video_url,
    cl2.campaign_lead_map_id::text as campaign_lead_map_id,
    cl2.lead_category_name
   from sp_campaign_leads cl2
     join sp_campaigns c on c.id = cl2.campaign_id
     join sp_clients s on s.id = c.client_id and s.slug = 'paycaptain'::text
     left join lateral ( select min(r2.received_at) as first_reply_at
           from sp_replies r2
          where lower(r2.replier_email) = lower(cl2.lead_email)) r on true
     left join paycaptain_leads l on lower(l.email) = lower(cl2.lead_email)
  where cl2.lead_category_name = any (array['Interested'::text, 'human_action_required'::text])
  order by (lower(cl2.lead_email)), (cl2.campaign_lead_map_id is null), r.first_reply_at desc nulls last)
union all
( select distinct on (lower(cl2.lead_email)) 'acceleration_partners'::text as client,
    r.first_reply_at as date_converted,
    cl2.lead_email as replier_email,
    cl2.smartlead_lead_id::text as smartlead_lead_id,
    coalesce(l.full_name, nullif(trim(both from (coalesce(cl2.first_name, ''::text) || ' '::text) || coalesce(cl2.last_name, ''::text)), ''::text)) as full_name,
    coalesce(l.company_name, cl2.company_name) as company_name,
    l.title,
    l.mobile_phone as phone,
    l.linkedin_url,
    l.company_linkedin_url,
    coalesce(l.company_website, l.company_domain) as website,
    l.industry,
    null::text as call_brief_pdf_url,
    null::text as sendspark_video_url,
    cl2.campaign_lead_map_id::text as campaign_lead_map_id,
    cl2.lead_category_name
   from sp_campaign_leads cl2
     join sp_campaigns c on c.id = cl2.campaign_id
     join sp_clients s on s.id = c.client_id and s.slug = 'acceleration_partners'::text
     left join lateral ( select min(r2.received_at) as first_reply_at
           from sp_replies r2
          where lower(r2.replier_email) = lower(cl2.lead_email)) r on true
     left join acceleration_partners_leads l on lower(l.email) = lower(cl2.lead_email)
  where cl2.lead_category_name = any (array['Interested'::text, 'human_action_required'::text])
  order by (lower(cl2.lead_email)), (cl2.campaign_lead_map_id is null), r.first_reply_at desc nulls last)
union all
( select distinct on (lower(cl2.lead_email)) 'omnivate'::text as client,
    r.first_reply_at as date_converted,
    cl2.lead_email as replier_email,
    cl2.smartlead_lead_id::text as smartlead_lead_id,
    coalesce(l.full_name, nullif(trim(both from (coalesce(cl2.first_name, ''::text) || ' '::text) || coalesce(cl2.last_name, ''::text)), ''::text)) as full_name,
    coalesce(l.company_name, cl2.company_name) as company_name,
    l.title,
    l.mobile_phone as phone,
    l.linkedin_url,
    l.company_linkedin_url,
    coalesce(l.company_website, l.company_domain) as website,
    null::text as industry,
    null::text as call_brief_pdf_url,
    null::text as sendspark_video_url,
    cl2.campaign_lead_map_id::text as campaign_lead_map_id,
    cl2.lead_category_name
   from sp_campaign_leads cl2
     join sp_campaigns c on c.id = cl2.campaign_id
     join sp_clients s on s.id = c.client_id and s.slug = 'omnivate'::text
     left join lateral ( select min(r2.received_at) as first_reply_at
           from sp_replies r2
          where lower(r2.replier_email) = lower(cl2.lead_email)) r on true
     left join omnivate_leads l on lower(l.email) = lower(cl2.lead_email)
  where cl2.lead_category_name = any (array['Interested'::text, 'human_action_required'::text])
  order by (lower(cl2.lead_email)), (cl2.campaign_lead_map_id is null), r.first_reply_at desc nulls last);
