-- =============================================================
-- cockpit_read_models_008 - alert rebuild: tiering + cockpit-generated
-- lead-runway alert (Omar's 2026-07-06 review, "strip and rebuild
-- section by section")
-- =============================================================
-- Findings that shaped this:
--   * Detection already works: sp_infra_alerts held burn_detected +
--     warmup_low_rep for the two burning Cylindo boxes since 06-24 -
--     but they drowned among 28 open Cylindo alerts (21 of them
--     reconnect/reapply maintenance noise). Omar: "I don't trust any
--     of this."
--   * The perf plugin's sp_alerts.client_runway_low never reached the
--     UI at all, and it counts follow-up/referral campaigns.
-- Design:
--   1. Tier every alert: actionable (a human must act now) vs
--      maintenance (self-healing retries, cleanup chores). Top-line
--      counts show ACTIONABLE only.
--   2. cockpit_alerts: app-generated alerts. First rule: lead_runway,
--      evaluated daily from vw_cockpit_client_runway (PRIMARY campaigns
--      only), auto-resolving when runway recovers. One open alert per
--      (client, alert_type).
--   3. vw_cockpit_alerts = sp_infra_alerts UNION cockpit_alerts.
--      Cockpit ids are exposed +1e9 so the resolve/acknowledge routes
--      can band on id (sp_infra_alerts stays plugin-owned).
-- Additive + view replace. Applied via Supabase Management API.
-- Rollback:
--   SELECT cron.unschedule('cockpit-lead-runway-alert');
--   DROP FUNCTION IF EXISTS public.fn_cockpit_eval_lead_runway();
--   CREATE OR REPLACE VIEW public.vw_cockpit_alerts AS <007 body>;
--   DROP TABLE IF EXISTS public.cockpit_alerts;
--   DROP FUNCTION IF EXISTS public.fn_cockpit_alert_tier(text);
-- =============================================================

-- 1. Tier taxonomy - ONE source of truth used by every alert surface.
CREATE OR REPLACE FUNCTION public.fn_cockpit_alert_tier(p_alert_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_alert_type IN (
      'burn_detected',        -- a domain/box burned: swap now
      'warmup_low_rep',       -- reputation under threshold: act
      'send_block',           -- provider blocked sending
      'warmup_not_warming',   -- warmup dead on a box that needs it
      'lead_runway',          -- cockpit: primary campaigns running dry
      'blacklist_listed'      -- future: DNSBL listing (currently surfaced via HEALTH-3 card)
    ) THEN 'actionable'
    ELSE 'maintenance'        -- reconnects, reapply retries, drift,
                              -- stuck ramps, unattributed rows, etc.
  END;
$$;

-- 2. Cockpit-generated alerts (same shape as sp_infra_alerts; RLS on,
--    no policies -> service-role only).
CREATE TABLE IF NOT EXISTS public.cockpit_alerts (
  id               BIGSERIAL PRIMARY KEY,
  alert_type       TEXT NOT NULL,
  severity         TEXT NOT NULL,           -- high | medium | low
  client           TEXT,
  domain_id        BIGINT,
  title            TEXT NOT NULL,
  description      TEXT,
  proposed_actions JSONB,
  status           TEXT NOT NULL DEFAULT 'open',  -- open | resolved
  slack_message_ts TEXT,
  resolved_by      TEXT,
  resolved_at      TIMESTAMPTZ,
  resolution_note  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cockpit_alerts_open_dedupe
  ON public.cockpit_alerts(client, alert_type) WHERE status = 'open';
ALTER TABLE public.cockpit_alerts ENABLE ROW LEVEL SECURITY;

-- 3. Unified alert view. Existing columns keep their exact positions
--    (CREATE OR REPLACE constraint); tier + source are appended.
CREATE OR REPLACE VIEW public.vw_cockpit_alerts AS
SELECT
  a.id,
  a.alert_type,
  a.severity,
  a.client,
  a.domain_id,
  a.title,
  a.description,
  a.proposed_actions,
  a.status,
  a.resolution_note,
  a.resolved_by,
  a.resolved_at,
  a.slack_message_ts,
  a.created_at,
  d.domain_name,
  public.fn_cockpit_alert_tier(a.alert_type) AS tier,
  'infra'::text AS source
FROM sp_infra_alerts a
LEFT JOIN sp_domains d ON d.id = a.domain_id
UNION ALL
SELECT
  c.id + 1000000000,
  c.alert_type,
  c.severity,
  c.client,
  c.domain_id,
  c.title,
  c.description,
  c.proposed_actions,
  c.status,
  c.resolution_note,
  c.resolved_by,
  c.resolved_at,
  c.slack_message_ts,
  c.created_at,
  d.domain_name,
  public.fn_cockpit_alert_tier(c.alert_type) AS tier,
  'cockpit'::text AS source
FROM cockpit_alerts c
LEFT JOIN sp_domains d ON d.id = c.domain_id;

-- 4. Portfolio roll-up counts ACTIONABLE open alerts only (was: every
--    open sp_infra_alerts row - the untrusted number Omar called out).
CREATE OR REPLACE VIEW public.vw_cockpit_portfolio_health AS
SELECT
  c.slug AS client,
  c.active,
  COALESCE(a.open_alerts, 0::bigint) AS open_alerts,
  COALESCE(r.at_risk, 0::bigint) AS at_risk_mailboxes,
  COALESCE(b.listed, 0::bigint) AS listed_domains,
  COALESCE(mb.non_retired, 0::bigint) AS non_retired_mailboxes,
  COALESCE(mb.active_boxes, 0::bigint) AS active_mailboxes
FROM sp_clients c
LEFT JOIN (
  SELECT v.client, count(*) AS open_alerts
  FROM vw_cockpit_alerts v
  WHERE v.status = 'open' AND v.tier = 'actionable'
  GROUP BY v.client
) a ON a.client = c.slug
LEFT JOIN (
  SELECT sp_mailboxes.client, count(*) AS at_risk
  FROM sp_mailboxes
  WHERE sp_mailboxes.warmup_reputation_pct < 97::numeric
    AND (sp_mailboxes.lifecycle_status <> ALL (ARRAY['retired'::text, 'parked'::text, 'burnt'::text, 'master'::text]))
  GROUP BY sp_mailboxes.client
) r ON r.client = c.slug
LEFT JOIN (
  SELECT sp_domain_blacklist_checks.client, count(*) AS listed
  FROM sp_domain_blacklist_checks
  WHERE sp_domain_blacklist_checks.status = 'listed'::text
  GROUP BY sp_domain_blacklist_checks.client
) b ON b.client = c.slug
LEFT JOIN (
  SELECT sp_mailboxes.client,
    count(*) FILTER (WHERE sp_mailboxes.lifecycle_status <> 'retired'::text) AS non_retired,
    count(*) FILTER (WHERE sp_mailboxes.lifecycle_status = 'active'::text) AS active_boxes
  FROM sp_mailboxes
  GROUP BY sp_mailboxes.client
) mb ON mb.client = c.slug;

-- 5. Lead-runway evaluator: Alert #1 from Omar's review. Reads the
--    PRIMARY-scoped runway view (007). Auto-resolves on recovery,
--    updates in place while open (created_at keeps the first-seen date).
CREATE OR REPLACE FUNCTION public.fn_cockpit_eval_lead_runway()
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  r RECORD;
BEGIN
  -- Recovery pass first: close open alerts whose client is no longer
  -- at/below the warning threshold (or has no active primaries left).
  UPDATE cockpit_alerts ca
  SET status = 'resolved',
      resolved_at = now(),
      resolved_by = 'cockpit-auto',
      resolution_note = 'Auto-resolved: primary lead runway recovered above the warning threshold'
  WHERE ca.alert_type = 'lead_runway'
    AND ca.status = 'open'
    AND NOT EXISTS (
      SELECT 1
      FROM vw_cockpit_client_runway rw
      LEFT JOIN client_analytics_config cfg ON cfg.client = rw.client
      WHERE rw.client = ca.client
        AND rw.runway_days IS NOT NULL
        AND rw.runway_days <= COALESCE(cfg.runway_warning_days, 7)
    );

  FOR r IN
    SELECT rw.client,
           s.display_name,
           rw.runway_days,
           rw.primary_active_campaigns,
           rw.leads_not_started,
           rw.remaining_emails,
           rw.active_daily_capacity,
           COALESCE(cfg.runway_warning_days, 7)  AS warn_days,
           COALESCE(cfg.runway_critical_days, 3) AS crit_days
    FROM vw_cockpit_client_runway rw
    JOIN sp_clients s ON s.slug = rw.client AND s.active
    LEFT JOIN client_analytics_config cfg ON cfg.client = rw.client
    WHERE rw.runway_days IS NOT NULL
      AND rw.runway_days <= COALESCE(cfg.runway_warning_days, 7)
  LOOP
    INSERT INTO cockpit_alerts
      (alert_type, severity, client, title, description, proposed_actions)
    VALUES (
      'lead_runway',
      CASE WHEN r.runway_days <= r.crit_days THEN 'high' ELSE 'medium' END,
      r.client,
      COALESCE(r.display_name, r.client) || ' has ' || r.runway_days ||
        ' days of primary lead runway',
      'Across ' || r.primary_active_campaigns ||
        ' active primary campaign(s): ' || r.leads_not_started ||
        ' leads not started; ' || r.remaining_emails ||
        ' emails remaining at ' || COALESCE(r.active_daily_capacity, 0) ||
        '/day capacity. Follow-up and referral campaigns are excluded.',
      jsonb_build_array(
        'Top up leads on the active primary campaigns',
        'Or mark finished campaigns as done (campaigns tab) so they stop counting toward runway',
        'If a new campaign is imminent, upload its list before runway hits zero'
      )
    )
    ON CONFLICT (client, alert_type) WHERE status = 'open'
    DO UPDATE SET
      severity    = EXCLUDED.severity,
      title       = EXCLUDED.title,
      description = EXCLUDED.description;
  END LOOP;
END;
$fn$;

-- 6. Daily schedule, after the sync (~07:43), mailbox snapshot (09:05)
--    and send-split (09:10) crons.
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cockpit-lead-runway-alert') THEN
    PERFORM cron.schedule(
      'cockpit-lead-runway-alert',
      '20 9 * * *',
      'SELECT public.fn_cockpit_eval_lead_runway()'
    );
  END IF;
END;
$do$;

-- 7. First evaluation now (as of 07-06 data this opens: cylindo HIGH
--    at 0.83 days, acceleration_partners MEDIUM at 8.84 days).
SELECT public.fn_cockpit_eval_lead_runway();
