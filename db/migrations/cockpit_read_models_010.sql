-- =============================================================
-- cockpit_read_models_010 - Ready Bank daily snapshot (Omar 2026-07-06:
-- replaces the "not too useful" lead-pipeline funnel with the numbers he
-- actually asked for, per client)
-- =============================================================
-- The questions the Ready Bank answers (from the meeting):
--   1. Total qualified contacts in our database (the TAM)
--   2. Of those, how many have a VERIFIED working email
--   3. How many are LinkedIn-only (qualified minus verified email)
--   4. How many have we already reached out to / are in a campaign
--   5. How many verified-email leads are still UNTOUCHED (the fuel tank)
--
-- Source = the per-client v_{slug}_tam views (multi-channel TAM per
-- knowledge/system-rules/lead-table-qualification-schema.md Principle 8,
-- with email_reachable / linkedin_reachable booleans). Those views scan
-- 80k+ rows - far too heavy per page load - so counts are materialized
-- daily into a tiny table (same pattern as sp_mailbox_daily / FND-3) and
-- the UI reads the latest row. Accuracy bar is "last 24h" per Omar.
--
-- "In a campaign" = smartlead_uploaded (covers reached-out AND queued).
-- v_{slug}_actually_emailed (live send events) exists only for cylindo
-- today; when it standardizes across clients this function can upgrade.
--
-- NOTE: clients are enumerated explicitly (their lead tables differ).
-- Adding a client = add a block here. Guarded so one missing view never
-- kills the whole snapshot.
-- Rollback:
--   SELECT cron.unschedule('cockpit-ready-bank-daily');
--   DROP FUNCTION IF EXISTS public.fn_cockpit_snapshot_ready_bank();
--   DROP TABLE IF EXISTS public.cockpit_ready_bank_daily;
-- =============================================================

CREATE TABLE IF NOT EXISTS public.cockpit_ready_bank_daily (
  client          TEXT NOT NULL,
  snapshot_date   DATE NOT NULL,
  qualified_total INTEGER NOT NULL DEFAULT 0,
  email_verified  INTEGER NOT NULL DEFAULT 0,
  linkedin_only   INTEGER NOT NULL DEFAULT 0,
  in_campaign     INTEGER NOT NULL DEFAULT 0,
  available_email INTEGER NOT NULL DEFAULT 0,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client, snapshot_date)
);
ALTER TABLE public.cockpit_ready_bank_daily ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fn_cockpit_snapshot_ready_bank()
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN
  -- cylindo
  BEGIN
    INSERT INTO cockpit_ready_bank_daily
      (client, snapshot_date, qualified_total, email_verified, linkedin_only, in_campaign, available_email)
    SELECT 'cylindo', current_date,
      count(*),
      count(*) FILTER (WHERE email_reachable),
      count(*) FILTER (WHERE linkedin_reachable AND NOT email_reachable),
      count(*) FILTER (WHERE COALESCE(smartlead_uploaded, false)),
      count(*) FILTER (WHERE email_reachable AND NOT COALESCE(smartlead_uploaded, false))
    FROM v_cylindo_tam
    ON CONFLICT (client, snapshot_date) DO UPDATE SET
      qualified_total = EXCLUDED.qualified_total,
      email_verified  = EXCLUDED.email_verified,
      linkedin_only   = EXCLUDED.linkedin_only,
      in_campaign     = EXCLUDED.in_campaign,
      available_email = EXCLUDED.available_email,
      computed_at     = now();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'ready-bank snapshot failed for cylindo: %', SQLERRM;
  END;

  -- paycaptain
  BEGIN
    INSERT INTO cockpit_ready_bank_daily
      (client, snapshot_date, qualified_total, email_verified, linkedin_only, in_campaign, available_email)
    SELECT 'paycaptain', current_date,
      count(*),
      count(*) FILTER (WHERE email_reachable),
      count(*) FILTER (WHERE linkedin_reachable AND NOT email_reachable),
      count(*) FILTER (WHERE COALESCE(smartlead_uploaded, false)),
      count(*) FILTER (WHERE email_reachable AND NOT COALESCE(smartlead_uploaded, false))
    FROM v_paycaptain_tam
    ON CONFLICT (client, snapshot_date) DO UPDATE SET
      qualified_total = EXCLUDED.qualified_total,
      email_verified  = EXCLUDED.email_verified,
      linkedin_only   = EXCLUDED.linkedin_only,
      in_campaign     = EXCLUDED.in_campaign,
      available_email = EXCLUDED.available_email,
      computed_at     = now();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'ready-bank snapshot failed for paycaptain: %', SQLERRM;
  END;

  -- acceleration_partners
  BEGIN
    INSERT INTO cockpit_ready_bank_daily
      (client, snapshot_date, qualified_total, email_verified, linkedin_only, in_campaign, available_email)
    SELECT 'acceleration_partners', current_date,
      count(*),
      count(*) FILTER (WHERE email_reachable),
      count(*) FILTER (WHERE linkedin_reachable AND NOT email_reachable),
      count(*) FILTER (WHERE COALESCE(smartlead_uploaded, false)),
      count(*) FILTER (WHERE email_reachable AND NOT COALESCE(smartlead_uploaded, false))
    FROM v_acceleration_partners_tam
    ON CONFLICT (client, snapshot_date) DO UPDATE SET
      qualified_total = EXCLUDED.qualified_total,
      email_verified  = EXCLUDED.email_verified,
      linkedin_only   = EXCLUDED.linkedin_only,
      in_campaign     = EXCLUDED.in_campaign,
      available_email = EXCLUDED.available_email,
      computed_at     = now();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'ready-bank snapshot failed for acceleration_partners: %', SQLERRM;
  END;

  -- omnivate
  BEGIN
    INSERT INTO cockpit_ready_bank_daily
      (client, snapshot_date, qualified_total, email_verified, linkedin_only, in_campaign, available_email)
    SELECT 'omnivate', current_date,
      count(*),
      count(*) FILTER (WHERE email_reachable),
      count(*) FILTER (WHERE linkedin_reachable AND NOT email_reachable),
      count(*) FILTER (WHERE COALESCE(smartlead_uploaded, false)),
      count(*) FILTER (WHERE email_reachable AND NOT COALESCE(smartlead_uploaded, false))
    FROM v_omnivate_tam
    ON CONFLICT (client, snapshot_date) DO UPDATE SET
      qualified_total = EXCLUDED.qualified_total,
      email_verified  = EXCLUDED.email_verified,
      linkedin_only   = EXCLUDED.linkedin_only,
      in_campaign     = EXCLUDED.in_campaign,
      available_email = EXCLUDED.available_email,
      computed_at     = now();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'ready-bank snapshot failed for omnivate: %', SQLERRM;
  END;
END;
$fn$;

-- Daily at 09:12 UTC (after the ~07:43 sync; before the 09:20 runway alert)
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cockpit-ready-bank-daily') THEN
    PERFORM cron.schedule(
      'cockpit-ready-bank-daily',
      '12 9 * * *',
      'SELECT public.fn_cockpit_snapshot_ready_bank()'
    );
  END IF;
END;
$do$;

-- First snapshot now
SELECT public.fn_cockpit_snapshot_ready_bank();
