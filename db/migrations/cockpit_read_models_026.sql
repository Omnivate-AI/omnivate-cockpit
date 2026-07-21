-- cockpit_read_models_026 — V4: unique contacts on campaigns view + provider matrix daily aggregate
-- Applied live via Supabase Management API on 2026-07-21 (MCP token dead, standing workaround).
--
-- 1) vw_cockpit_campaigns: append all_time_unique_contacts (sp_campaign_lifetime.unique_sent —
--    Smartlead's own lifetime unique-leads-contacted). Appended LAST: CREATE OR REPLACE VIEW
--    cannot insert columns mid-list.
-- 2) cockpit_provider_matrix_daily: tiny pre-aggregated sender-provider × recipient-provider
--    daily cells (FND-3 pattern — the app never scans sp_send_events per request).
-- 3) cockpit_fill_provider_matrix(p_days): self-healing upsert, mirrors sp_fill_recipient_send_split's
--    join logic (from_email → vw_sp_mailboxes; raw_payload->>'to_email' domain → sp_mx_cache).
-- 4) pg_cron 09:15 UTC daily (after 09:10 recipient-split fill), idempotent schedule.

-- 1 ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_cockpit_campaigns AS
 SELECT c.id,
    c.smartlead_campaign_id,
    cl.slug AS client,
    c.name AS campaign_name,
    c.status,
    c.status = 'ACTIVE'::text AS is_active,
        CASE
            WHEN c.name ~* '(subsequence|follow[- ]?up)'::text THEN 'subsequence'::text
            ELSE 'primary'::text
        END AS campaign_type,
    c.sequence_length,
    c.daily_send_cap,
    c.created_at,
    c.updated_at,
    c.last_synced_at,
    lt.sent AS all_time_emails_sent,
    lt.replies AS all_time_replies,
    lt.interested AS all_time_interested,
    lt.total_leads,
    lt.not_started,
    lt.in_progress,
    lt.bounces AS all_time_bounces,
    COALESCE(mb.cnt, 0::bigint)::integer AS mailbox_count,
    cc.campaign_class,
    cc.considered_done,
    lt.unique_sent AS all_time_unique_contacts
   FROM sp_campaigns c
     JOIN sp_clients cl ON cl.id = c.client_id
     LEFT JOIN sp_campaign_lifetime lt ON lt.campaign_id = c.id
     LEFT JOIN LATERAL ( SELECT count(*) AS cnt
           FROM sp_campaign_mailbox_roster cr
          WHERE cr.campaign_id = c.id AND cr.detached_at IS NULL) mb ON true
     LEFT JOIN vw_cockpit_campaign_class cc ON cc.id = c.id;

-- 2 ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cockpit_provider_matrix_daily (
  day date NOT NULL,
  client text NOT NULL,
  sender_provider text NOT NULL,
  recipient_provider text NOT NULL,
  sends integer NOT NULL DEFAULT 0,
  replies integer NOT NULL DEFAULT 0,
  replies_ooo integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, client, sender_provider, recipient_provider)
);

ALTER TABLE cockpit_provider_matrix_daily ENABLE ROW LEVEL SECURITY;

-- 3 ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cockpit_fill_provider_matrix(p_days integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_count integer;
begin
  with sends as (
    select e.sent_at::date as day,
           cl.slug as client,
           case when m.provider_canonical in ('google','microsoft') then m.provider_canonical
                else 'other' end as sender_provider,
           case when mx.provider in ('google','microsoft') then mx.provider
                else 'other' end as recipient_provider,
           count(*) as sends
    from sp_send_events e
    join sp_clients cl on cl.id = e.client_id
    join vw_sp_mailboxes m on lower(m.email) = lower(e.from_email)
    left join sp_mx_cache mx
      on mx.domain = lower(split_part(e.raw_payload->>'to_email', '@', 2))
    where e.sent_at::date >= current_date - p_days
      and e.sent_at::date < current_date
    group by 1, 2, 3, 4
  ),
  replies as (
    select r.received_at::date as day,
           m.client as client,
           case when m.provider_canonical in ('google','microsoft') then m.provider_canonical
                else 'other' end as sender_provider,
           case when r.recipient_provider in ('google','microsoft') then r.recipient_provider
                else 'other' end as recipient_provider,
           count(*) as replies,
           count(*) filter (where r.is_out_of_office) as replies_ooo
    from sp_replies r
    join vw_sp_mailboxes m on m.id = r.mailbox_id
    where r.received_at::date >= current_date - p_days
      and r.received_at::date < current_date
      and m.client is not null
    group by 1, 2, 3, 4
  ),
  merged as (
    select day, client, sender_provider, recipient_provider,
           coalesce(s.sends, 0) as sends,
           coalesce(r.replies, 0) as replies,
           coalesce(r.replies_ooo, 0) as replies_ooo
    from sends s
    full outer join replies r using (day, client, sender_provider, recipient_provider)
  )
  insert into cockpit_provider_matrix_daily
    (day, client, sender_provider, recipient_provider, sends, replies, replies_ooo)
  select day, client, sender_provider, recipient_provider, sends, replies, replies_ooo
  from merged
  on conflict (day, client, sender_provider, recipient_provider)
  do update set sends       = excluded.sends,
                replies     = excluded.replies,
                replies_ooo = excluded.replies_ooo,
                updated_at  = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

-- 4 ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cockpit-provider-matrix-daily') THEN
    PERFORM cron.schedule('cockpit-provider-matrix-daily', '15 9 * * *',
                          'select public.cockpit_fill_provider_matrix(7);');
  END IF;
END $$;

-- Backfill (run once after apply): send-event capture began 2026-06-03.
-- select public.cockpit_fill_provider_matrix(60);
