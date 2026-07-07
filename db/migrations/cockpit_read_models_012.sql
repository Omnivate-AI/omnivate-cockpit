-- =============================================================
-- cockpit_read_models_012 - send-floor alert (Omar's R7 revision,
-- ClickUp comment 2026-07-07: "I still want the send target - if sending
-- is below a certain number for each client, we get alerted... we're able
-- to set a specific number. We only get alerted if sending is below this
-- on a weekday. Make sure weekends are considered.")
-- =============================================================
-- The number: sp_clients.min_daily_send_volume - already per-client,
-- already editable in the app (Mailboxes tab -> Sending Capacity card ->
-- pencil -> /api/clients/[slug]/mailbox-config). NULL/0 = not monitored.
-- The day evaluated: yesterday (facts land with the morning sync). If
-- yesterday was Sat/Sun the function does NOTHING - no firing (weekends
-- never alert) and no resolving (a Friday shortfall alert survives the
-- weekend until Monday's data is judged on Tuesday).
-- Same dedupe/auto-resolve mechanics as lead_runway (008): one open
-- alert per client, updated in place, auto-resolves on recovery.
-- Live effect on first run (evaluating Mon 06 Jul): paycaptain fires
-- (1,555 sent vs 3,000 floor); AP exactly at floor (1,500) stays quiet;
-- cylindo + omnivate have no floor set.
-- Rollback:
--   SELECT cron.unschedule('cockpit-send-floor-alert');
--   DROP FUNCTION IF EXISTS public.fn_cockpit_eval_send_floor();
--   UPDATE cockpit_alerts SET status='resolved', resolved_at=now(),
--     resolved_by='rollback' WHERE alert_type='send_floor' AND status='open';
--   re-create fn_cockpit_alert_tier without 'send_floor'.
-- =============================================================

-- 1. send_floor is an ACTIONABLE alert type
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
      'send_floor',           -- cockpit: weekday sending below the client minimum
      'blacklist_listed'      -- future: DNSBL listing (currently surfaced via HEALTH-3 card)
    ) THEN 'actionable'
    ELSE 'maintenance'
  END;
$$;

-- 2. Evaluator
CREATE OR REPLACE FUNCTION public.fn_cockpit_eval_send_floor()
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_day date := current_date - 1;
  r RECORD;
BEGIN
  -- Weekend day under evaluation: never fire, never resolve.
  IF extract(isodow FROM v_day) >= 6 THEN
    RETURN;
  END IF;

  -- Recovery pass: close open alerts for clients now at/above the floor
  -- on the evaluated weekday (or whose floor was unset/cleared).
  UPDATE cockpit_alerts ca
  SET status = 'resolved',
      resolved_at = now(),
      resolved_by = 'cockpit-auto',
      resolution_note = 'Auto-resolved: weekday sending recovered to or above the client minimum'
  WHERE ca.alert_type = 'send_floor'
    AND ca.status = 'open'
    AND NOT EXISTS (
      SELECT 1
      FROM sp_clients c
      LEFT JOIN (
        SELECT vc.client, COALESCE(sum(d.emails_sent), 0) AS sent
        FROM vw_cockpit_campaign_daily d
        JOIN vw_cockpit_campaigns vc ON vc.smartlead_campaign_id = d.campaign_id
        WHERE d.snapshot_date = v_day
        GROUP BY vc.client
      ) s ON s.client = c.slug
      WHERE c.slug = ca.client
        AND c.active
        AND c.min_daily_send_volume IS NOT NULL
        AND c.min_daily_send_volume > 0
        AND COALESCE(s.sent, 0) < c.min_daily_send_volume
    );

  FOR r IN
    SELECT c.slug,
           c.display_name,
           c.min_daily_send_volume AS floor_volume,
           COALESCE(s.sent, 0) AS sent
    FROM sp_clients c
    LEFT JOIN (
      SELECT vc.client, COALESCE(sum(d.emails_sent), 0) AS sent
      FROM vw_cockpit_campaign_daily d
      JOIN vw_cockpit_campaigns vc ON vc.smartlead_campaign_id = d.campaign_id
      WHERE d.snapshot_date = v_day
      GROUP BY vc.client
    ) s ON s.client = c.slug
    WHERE c.active
      AND c.min_daily_send_volume IS NOT NULL
      AND c.min_daily_send_volume > 0
      AND COALESCE(s.sent, 0) < c.min_daily_send_volume
  LOOP
    INSERT INTO cockpit_alerts
      (alert_type, severity, client, title, description, proposed_actions)
    VALUES (
      'send_floor',
      CASE WHEN r.sent = 0 THEN 'high' ELSE 'medium' END,
      r.slug,
      COALESCE(r.display_name, r.slug) || ' sent ' || r.sent ||
        ' emails on ' || to_char(v_day, 'Dy DD Mon') ||
        ' — below the ' || r.floor_volume || '/day minimum',
      'Weekday sending fell below the per-client minimum: ' || r.sent ||
        ' of ' || r.floor_volume || ' on ' ||
        to_char(v_day, 'FMDay DD Mon YYYY') ||
        '. Weekends are never evaluated. The minimum is editable per client on the Mailboxes tab (Sending Capacity card, pencil icon).',
      jsonb_build_array(
        'Check campaign statuses — paused or drained campaigns are the usual cause',
        'Check the mailbox pool: burnt or at-risk boxes reduce capacity (Needs Action card)',
        'Check lead runway — campaigns out of leads stop sending',
        'If the minimum itself is wrong, adjust it via the pencil on the Sending Capacity card'
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

-- 3. Daily at 09:25 UTC (after sync ~07:43, ready-bank 09:12, runway 09:20)
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cockpit-send-floor-alert') THEN
    PERFORM cron.schedule(
      'cockpit-send-floor-alert',
      '25 9 * * *',
      'SELECT public.fn_cockpit_eval_send_floor()'
    );
  END IF;
END;
$do$;

-- 4. First evaluation now
SELECT public.fn_cockpit_eval_send_floor();
