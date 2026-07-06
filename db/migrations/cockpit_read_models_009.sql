-- =============================================================
-- cockpit_read_models_009 - vw_cockpit_campaigns gains campaign_class +
-- considered_done (Omar 2026-07-06: campaigns tab shows ALL campaigns
-- with an active/past split, referral campaigns must classify correctly,
-- and finished campaigns get a mark-done control)
-- =============================================================
-- The old campaign_type (primary|subsequence) misses referrals entirely -
-- "paycaptain_referral_standalone" classified as primary. campaign_class
-- (primary|follow_up|referral, operator-overridable) comes from
-- vw_cockpit_campaign_class (007). considered_done is the operator's
-- "this campaign is finished, stop counting it" switch.
-- Columns appended at the end (CREATE OR REPLACE constraint).
-- Rollback: re-create the view without the last join/two columns.
-- =============================================================

CREATE OR REPLACE VIEW public.vw_cockpit_campaigns AS
SELECT
  c.id,
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
  cc.considered_done
FROM sp_campaigns c
JOIN sp_clients cl ON cl.id = c.client_id
LEFT JOIN sp_campaign_lifetime lt ON lt.campaign_id = c.id
LEFT JOIN LATERAL (
  SELECT count(*) AS cnt
  FROM sp_campaign_mailbox_roster cr
  WHERE cr.campaign_id = c.id AND cr.detached_at IS NULL
) mb ON true
LEFT JOIN vw_cockpit_campaign_class cc ON cc.id = c.id;
