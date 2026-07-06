-- =============================================================
-- cockpit_read_models_007 — campaign classification + primary-scoped runway
-- =============================================================
-- From Omar's 2026-07-06 cockpit review:
--   * Follow-up and referral campaigns "don't count in the same way" —
--     runway and lead-runway alerts must consider PRIMARY campaigns only.
--   * Smartlead never auto-completes a campaign (Design Studios drained
--     06-19 yet stayed ACTIVE showing in-progress leads), so "done" needs
--     an explicit operator override the app can write.
--
-- Additive only. Applied via the Supabase Management API (the session MCP
-- token was stale); SQL kept here as the source of record.
-- Rollback:
--   DROP VIEW IF EXISTS public.vw_cockpit_client_runway;
--   DROP VIEW IF EXISTS public.vw_cockpit_campaign_class;
--   DROP TABLE IF EXISTS public.cockpit_campaign_overrides;
-- =============================================================

-- 1. App-owned per-campaign overrides (same posture as sp_*: RLS on, no
--    policies -> service-role only, which is how the cockpit reads/writes).
CREATE TABLE IF NOT EXISTS public.cockpit_campaign_overrides (
  campaign_id     BIGINT PRIMARY KEY REFERENCES public.sp_campaigns(id),
  class_override  TEXT CHECK (class_override IN ('primary','follow_up','referral')),
  considered_done BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cockpit_campaign_overrides ENABLE ROW LEVEL SECURITY;

-- 2. Classification view: name heuristic, operator override wins.
--    Order matters: referral before follow_up so "referral_followup"
--    campaigns classify as referral (both are excluded from primary math).
CREATE OR REPLACE VIEW public.vw_cockpit_campaign_class AS
SELECT
  c.id,
  c.client_id,
  c.smartlead_campaign_id,
  c.name,
  c.status,
  c.sequence_length,
  c.daily_send_cap,
  COALESCE(
    o.class_override,
    CASE
      WHEN c.name ~* 'referral'         THEN 'referral'
      WHEN c.name ~* 'follow[ _-]?up'   THEN 'follow_up'
      ELSE 'primary'
    END
  ) AS campaign_class,
  COALESCE(o.considered_done, false) AS considered_done
FROM public.sp_campaigns c
LEFT JOIN public.cockpit_campaign_overrides o ON o.campaign_id = c.id;

-- 3. Primary-scoped client runway + lead-progress rollup.
--    Same emails-left model as the plugin's migration 014
--    (not_started x seq + in_progress x (seq-1), / client daily capacity)
--    but summed over ACTIVE PRIMARY campaigns not marked done.
--    Also exposes the lead-status sums that power the per-client
--    runway slider on the Command Center.
CREATE OR REPLACE VIEW public.vw_cockpit_client_runway AS
WITH latest AS (
  SELECT DISTINCT ON (f.campaign_id)
    f.campaign_id, f.date, f.total_leads, f.leads_remaining, f.contacts_in_sequence
  FROM public.sp_daily_campaign_facts f
  ORDER BY f.campaign_id, f.date DESC
),
active_primary AS (
  SELECT
    cc.client_id,
    cc.id AS campaign_id,
    cc.sequence_length,
    l.date,
    COALESCE(l.total_leads, 0)          AS total_leads,
    COALESCE(l.leads_remaining, 0)      AS leads_not_started,
    COALESCE(l.contacts_in_sequence, 0) AS leads_in_progress,
    GREATEST(
      COALESCE(l.total_leads, 0)
        - COALESCE(l.leads_remaining, 0)
        - COALESCE(l.contacts_in_sequence, 0),
      0
    ) AS leads_completed,
    (COALESCE(l.leads_remaining, 0) * COALESCE(cc.sequence_length, 0)
       + COALESCE(l.contacts_in_sequence, 0)
         * GREATEST(COALESCE(cc.sequence_length, 0) - 1, 0)
    ) AS emails_left
  FROM public.vw_cockpit_campaign_class cc
  JOIN latest l ON l.campaign_id = cc.id
  WHERE cc.status = 'ACTIVE'
    AND cc.campaign_class = 'primary'
    AND NOT cc.considered_done
),
cap AS (
  SELECT DISTINCT ON (client_id) client_id, active_daily_capacity
  FROM public.sp_daily_client_facts
  ORDER BY client_id, date DESC
)
SELECT
  s.slug                    AS client,
  count(ap.campaign_id)     AS primary_active_campaigns,
  sum(ap.total_leads)       AS total_leads,
  sum(ap.leads_not_started) AS leads_not_started,
  sum(ap.leads_in_progress) AS leads_in_progress,
  sum(ap.leads_completed)   AS leads_completed,
  sum(ap.emails_left)       AS remaining_emails,
  cap.active_daily_capacity,
  CASE WHEN COALESCE(cap.active_daily_capacity, 0) > 0
       THEN round(sum(ap.emails_left)::numeric / cap.active_daily_capacity, 2)
       ELSE NULL
  END                       AS runway_days,
  max(ap.date)              AS facts_date
FROM active_primary ap
JOIN public.sp_clients s ON s.id = ap.client_id
LEFT JOIN cap ON cap.client_id = ap.client_id
GROUP BY s.slug, cap.active_daily_capacity;
