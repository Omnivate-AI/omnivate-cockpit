-- =============================================================
-- cockpit_read_models_016 - Ready Bank relabel (Omar 07-06/07-08).
-- =============================================================
-- The validation showed the Ready Bank "total" is built on REACHABILITY
-- (lead_status), not the qualification_decision column — so labelling it
-- "Qualified" over-reads (Cylindo: ~91k reachable but only ~61k actually
-- qualification_decision='qualified'; ~28k never decided). Fix = keep the
-- reachable total (relabel it "Total reachable" in the UI) and ADD a
-- separate, honest qualified count off qualification_decision.
-- omnivate_leads has NO qualification_decision column -> its block uses 0
-- (each client block is EXCEPTION-guarded + client-specific anyway).
-- Additive column; function replace; repopulates today's row.
-- Rollback:
--   ALTER TABLE public.cockpit_ready_bank_daily DROP COLUMN qualified;
--   (restore the 010 function body)
-- =============================================================

ALTER TABLE public.cockpit_ready_bank_daily
  ADD COLUMN IF NOT EXISTS qualified INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.fn_cockpit_snapshot_ready_bank()
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN
  -- cylindo
  BEGIN
    INSERT INTO cockpit_ready_bank_daily
      (client, snapshot_date, qualified_total, qualified, email_verified, linkedin_only, in_campaign, available_email)
    SELECT 'cylindo', current_date,
      count(*),
      count(*) FILTER (WHERE qualification_decision = 'qualified'),
      count(*) FILTER (WHERE email_reachable),
      count(*) FILTER (WHERE linkedin_reachable AND NOT email_reachable),
      count(*) FILTER (WHERE COALESCE(smartlead_uploaded, false)),
      count(*) FILTER (WHERE email_reachable AND NOT COALESCE(smartlead_uploaded, false))
    FROM v_cylindo_tam
    ON CONFLICT (client, snapshot_date) DO UPDATE SET
      qualified_total = EXCLUDED.qualified_total,
      qualified       = EXCLUDED.qualified,
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
      (client, snapshot_date, qualified_total, qualified, email_verified, linkedin_only, in_campaign, available_email)
    SELECT 'paycaptain', current_date,
      count(*),
      count(*) FILTER (WHERE qualification_decision = 'qualified'),
      count(*) FILTER (WHERE email_reachable),
      count(*) FILTER (WHERE linkedin_reachable AND NOT email_reachable),
      count(*) FILTER (WHERE COALESCE(smartlead_uploaded, false)),
      count(*) FILTER (WHERE email_reachable AND NOT COALESCE(smartlead_uploaded, false))
    FROM v_paycaptain_tam
    ON CONFLICT (client, snapshot_date) DO UPDATE SET
      qualified_total = EXCLUDED.qualified_total,
      qualified       = EXCLUDED.qualified,
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
      (client, snapshot_date, qualified_total, qualified, email_verified, linkedin_only, in_campaign, available_email)
    SELECT 'acceleration_partners', current_date,
      count(*),
      count(*) FILTER (WHERE qualification_decision = 'qualified'),
      count(*) FILTER (WHERE email_reachable),
      count(*) FILTER (WHERE linkedin_reachable AND NOT email_reachable),
      count(*) FILTER (WHERE COALESCE(smartlead_uploaded, false)),
      count(*) FILTER (WHERE email_reachable AND NOT COALESCE(smartlead_uploaded, false))
    FROM v_acceleration_partners_tam
    ON CONFLICT (client, snapshot_date) DO UPDATE SET
      qualified_total = EXCLUDED.qualified_total,
      qualified       = EXCLUDED.qualified,
      email_verified  = EXCLUDED.email_verified,
      linkedin_only   = EXCLUDED.linkedin_only,
      in_campaign     = EXCLUDED.in_campaign,
      available_email = EXCLUDED.available_email,
      computed_at     = now();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'ready-bank snapshot failed for acceleration_partners: %', SQLERRM;
  END;

  -- omnivate (no qualification_decision column -> qualified = 0)
  BEGIN
    INSERT INTO cockpit_ready_bank_daily
      (client, snapshot_date, qualified_total, qualified, email_verified, linkedin_only, in_campaign, available_email)
    SELECT 'omnivate', current_date,
      count(*),
      0,
      count(*) FILTER (WHERE email_reachable),
      count(*) FILTER (WHERE linkedin_reachable AND NOT email_reachable),
      count(*) FILTER (WHERE COALESCE(smartlead_uploaded, false)),
      count(*) FILTER (WHERE email_reachable AND NOT COALESCE(smartlead_uploaded, false))
    FROM v_omnivate_tam
    ON CONFLICT (client, snapshot_date) DO UPDATE SET
      qualified_total = EXCLUDED.qualified_total,
      qualified       = EXCLUDED.qualified,
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

-- Repopulate today's row with the new qualified count
SELECT public.fn_cockpit_snapshot_ready_bank();
