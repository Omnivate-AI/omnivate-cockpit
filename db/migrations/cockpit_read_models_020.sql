-- V3 Phase 2 (B1/C1): distinct contacts emailed over an arbitrary date range.
--
-- "Contacts per positive reply" needs the number of DISTINCT people emailed in
-- a window. Summing a per-day view would double-count any lead emailed on more
-- than one day (i.e. every follow-up) — which is precisely the emails-vs-people
-- gap this metric exists to expose. So it must be a true COUNT(DISTINCT lead)
-- over the window, which a fixed daily view can't express — hence an RPC.
--
-- Source: sp_send_events (webhook capture; live since ~2026-06-03). Bounds are
-- inclusive of both p_start and p_end, compared in UTC to match the facts'
-- UTC snapshot_date, and kept as a sent_at range so the sent_at index is used.

create or replace function cockpit_contacts_emailed(p_start date, p_end date)
returns table (client text, contacts_emailed bigint)
language sql
stable
as $$
  select cl.slug as client,
         count(distinct e.smartlead_lead_id) as contacts_emailed
  from sp_send_events e
  join sp_clients cl on cl.id = e.client_id
  where e.sent_at >= (p_start::timestamp at time zone 'UTC')
    and e.sent_at <  ((p_end + 1)::timestamp at time zone 'UTC')
    and e.smartlead_lead_id is not null
  group by cl.slug;
$$;

grant execute on function cockpit_contacts_emailed(date, date)
  to anon, authenticated, service_role;
