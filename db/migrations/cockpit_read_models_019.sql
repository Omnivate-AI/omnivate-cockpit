-- =============================================================
-- cockpit_read_models_019 — Acknowledge as a real state (V2 Phase 8)
-- =============================================================
-- Before: the cockpit's "Acknowledge" button HARD-RESOLVED the alert
-- (status='resolved', note 'Dismissed via dashboard') — it vanished from the
-- list (answer #8). Phase 8 makes acknowledge a distinct, visible state:
-- the alert stays status='open' (still real, still in the list, greyed) but
-- carries acknowledged_at/acknowledged_by, and is excluded from every
-- "needs attention" count (banner, sidebar badge, summary cards).
--
-- Additive columns on both alert source tables + expose them on the view.
-- Status vocabulary stays binary (open | resolved); "acknowledged" is
-- (status='open' AND acknowledged_at IS NOT NULL) — a derived state, not a
-- third status enum, so existing open/resolved filters keep working.
--
-- Rollback:
--   DROP VIEW vw_cockpit_alerts;  (recreate from 008 body)
--   ALTER TABLE sp_infra_alerts DROP COLUMN acknowledged_at, DROP COLUMN acknowledged_by;
--   ALTER TABLE cockpit_alerts  DROP COLUMN acknowledged_at, DROP COLUMN acknowledged_by;
-- =============================================================

ALTER TABLE sp_infra_alerts
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_by text;

ALTER TABLE cockpit_alerts
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_by text;

-- NB: CREATE OR REPLACE VIEW can only APPEND columns (existing columns must
-- keep their exact positions), so acknowledged_at/by go at the very end after
-- source — the cockpit reads via SELECT *, so column order is immaterial to it.
CREATE OR REPLACE VIEW vw_cockpit_alerts AS
 SELECT a.id,
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
    fn_cockpit_alert_tier(a.alert_type) AS tier,
    'infra'::text AS source,
    a.acknowledged_at,
    a.acknowledged_by
   FROM sp_infra_alerts a
     LEFT JOIN sp_domains d ON d.id = a.domain_id
UNION ALL
 SELECT c.id + 1000000000 AS id,
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
    fn_cockpit_alert_tier(c.alert_type) AS tier,
    'cockpit'::text AS source,
    c.acknowledged_at,
    c.acknowledged_by
   FROM cockpit_alerts c
     LEFT JOIN sp_domains d ON d.id = c.domain_id;
