-- V3 Phase 5 — blacklist reconciliation.
--
-- The Command Center card's "N blacklisted" (portfolio.listed_domains) counted
-- every status='listed' row, but ALL 135 estate-wide "listed" entries are
-- Smartlead's UI badge (listed_on = "SmartleadBadge: …") — shared-IP / SURBL
-- noise, not a confirmed authoritative DNSBL listing. Our own daily DNSBL check
-- shows them clean and inbox-placement stays ~100%. So the headline count must
-- reflect CONFIRMED listings only (currently 0), matching the reconciled
-- Blacklist Status card. Smartlead flags are surfaced separately in that card.

create or replace view vw_cockpit_portfolio_health as
 select c.slug as client,
    c.active,
    coalesce(a.open_alerts, 0::bigint) as open_alerts,
    coalesce(r.at_risk, 0::bigint) as at_risk_mailboxes,
    coalesce(b.listed, 0::bigint) as listed_domains,
    coalesce(mb.non_retired, 0::bigint) as non_retired_mailboxes,
    coalesce(mb.active_boxes, 0::bigint) as active_mailboxes
   from sp_clients c
     left join ( select v.client, count(*) as open_alerts
           from vw_cockpit_alerts v
          where v.status = 'open'::text and v.tier = 'actionable'::text
          group by v.client) a on a.client = c.slug
     left join ( select sp_mailboxes.client, count(*) as at_risk
           from sp_mailboxes
          where sp_mailboxes.warmup_reputation_pct < 97::numeric
            and (sp_mailboxes.lifecycle_status <> all (array['retired'::text, 'parked'::text, 'burnt'::text, 'master'::text]))
          group by sp_mailboxes.client) r on r.client = c.slug
     -- authoritative DNSBL listings only; Smartlead UI-badge noise excluded
     left join ( select vw_cockpit_blacklist.client, count(*) as listed
           from vw_cockpit_blacklist
          where vw_cockpit_blacklist.status = 'listed'::text
            and not (coalesce(vw_cockpit_blacklist.listed_on, ''::text) ilike 'SmartleadBadge%'::text)
          group by vw_cockpit_blacklist.client) b on b.client = c.slug
     left join ( select sp_mailboxes.client,
            count(*) filter (where sp_mailboxes.lifecycle_status <> 'retired'::text) as non_retired,
            count(*) filter (where sp_mailboxes.lifecycle_status = 'active'::text) as active_boxes
           from sp_mailboxes
          group by sp_mailboxes.client) mb on mb.client = c.slug;
